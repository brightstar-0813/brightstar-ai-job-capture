/**
 * Lever public postings API — https://api.lever.co/v0/postings/{company}?mode=json
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
  const loc = String(j.categories?.location || j.workplaceType || "");
  const text = `${loc} ${j.text || ""}`.slice(0, 2000);
  if (/hybrid/i.test(loc) && !/\bremote\b/i.test(loc)) return "Hybrid";
  if (/on[-\s]?site|office/i.test(loc) && !/\bremote\b/i.test(loc)) return "Onsite";
  if (/\bremote\b/i.test(text) || /work from home/i.test(text)) return "Remote";
  if (String(j.workplaceType || "").toLowerCase() === "remote") return "Remote";
  return loc ? "Onsite" : "Remote";
}

function mapJob(j, company) {
  const location = j.categories?.location || j.workplaceType || "";
  return emptyJobFields({
    id: `lever_${company}_${j.id}`,
    title: j.text || "",
    organization: j.categories?.team
      ? `${company} (${j.categories.team})`
      : company,
    location: String(location),
    work_arrangement: inferRemote(j),
    remote_restricted_to: String(location),
    source: "lever",
    date_posted: toIsoDate(j.createdAt),
    url: j.hostedUrl || j.applyUrl || "",
    description: plainText(j.descriptionPlain || j.description || ""),
    employment_type: j.categories?.commitment || "",
    experience_level: j.categories?.level || "",
  });
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchLeverJobs(_browser) {
  const companies = config.leverCompanies || [];
  const seen = new Set();
  const jobs = [];
  let boardErrors = 0;
  let fetched = 0;

  console.log(`[lever] scanning ${companies.length} companies`);

  for (const company of companies) {
    try {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
      const list = await fetchJson(url);
      if (!Array.isArray(list)) {
        boardErrors += 1;
        continue;
      }
      fetched += list.length;
      for (const raw of list) {
        const mapped = mapJob(raw, company);
        if (seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        const kept = keepNormalizedJob(mapped);
        if (kept) jobs.push(kept);
      }
    } catch (err) {
      boardErrors += 1;
      if (err.status !== 404) {
        console.warn(`[lever] ${company}: ${err.message}`);
      }
    }
  }

  console.log(
    `[lever] kept ${jobs.length} (fetched=${fetched}, boardErrors=${boardErrors})`
  );
  return { jobs };
}
