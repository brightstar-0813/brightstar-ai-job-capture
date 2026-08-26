/**
 * Ashby public job board API —
 * https://api.ashbyhq.com/posting-api/job-board/{org}
 */

import { config } from "../config.js";
import {
  fetchJson,
  plainText,
  toIsoDate,
  keepNormalizedJob,
  emptyJobFields,
} from "../sources/normalize.js";

function inferRemote(j) {
  const loc = String(
    j.location || j.address?.postalAddress || j.workplaceType || ""
  );
  const isRemote =
    j.isRemote === true ||
    String(j.workplaceType || "").toLowerCase() === "remote" ||
    /\bremote\b/i.test(loc);
  if (/hybrid/i.test(loc) && !isRemote) return "Hybrid";
  if (isRemote) return "Remote";
  if (/on[-\s]?site|office/i.test(loc)) return "Onsite";
  return isRemote ? "Remote" : "Onsite";
}

function mapJob(j, org) {
  const location =
    j.location ||
    j.address?.postalAddress ||
    (Array.isArray(j.locations)
      ? j.locations.map((l) => l.locationName || l).join(", ")
      : "") ||
    "";
  return emptyJobFields({
    id: `ashby_${org}_${j.id || j.jobId || j.slug}`,
    title: j.title || "",
    organization: j.department || org,
    location: String(location),
    work_arrangement: inferRemote(j),
    remote_restricted_to: String(location),
    source: "ashby",
    date_posted: toIsoDate(j.publishedAt || j.updatedAt),
    url: j.jobUrl || j.applyUrl || "",
    description: plainText(
      j.descriptionPlain || j.descriptionHtml || j.description || ""
    ),
    employment_type: j.employmentType || "",
  });
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchAshbyJobs(_browser) {
  const orgs = config.ashbyOrgs || [];
  const seen = new Set();
  const jobs = [];
  let boardErrors = 0;
  let fetched = 0;

  console.log(`[ashby] scanning ${orgs.length} orgs`);

  for (const org of orgs) {
    try {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`;
      const json = await fetchJson(url);
      const list = json.jobs || [];
      fetched += list.length;
      for (const raw of list) {
        const mapped = mapJob(raw, org);
        if (seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        const kept = keepNormalizedJob(mapped);
        if (kept) jobs.push(kept);
      }
    } catch (err) {
      boardErrors += 1;
      if (err.status !== 404) {
        console.warn(`[ashby] ${org}: ${err.message}`);
      }
    }
  }

  console.log(
    `[ashby] kept ${jobs.length} (fetched=${fetched}, boardErrors=${boardErrors})`
  );
  return { jobs };
}
