/**
 * Jobicy public API — https://jobicy.com/api/v2/remote-jobs
 */

import { config } from "../config.js";
import {
  fetchJson,
  plainText,
  toIsoDate,
  keepNormalizedJob,
  emptyJobFields,
} from "../sources/normalize.js";

const GEOS = ["usa", "apac", "anywhere"];

function mapJob(j, geoHint) {
  const locParts = [j.jobGeo, j.jobCountry, geoHint].filter(Boolean);
  const location = locParts.join(" | ");
  const region =
    geoHint === "usa" ? "US" : geoHint === "apac" ? "" : "";
  return emptyJobFields({
    id: `jobicy_${j.id}`,
    title: j.jobTitle || "",
    organization: j.companyName || "",
    location,
    work_arrangement: "Remote",
    remote_restricted_to:
      geoHint === "usa"
        ? "United States"
        : j.jobGeo || location,
    region,
    key_skills: Array.isArray(j.jobIndustry)
      ? j.jobIndustry.join(", ")
      : String(j.jobIndustry || ""),
    source: "jobicy",
    date_posted: toIsoDate(j.pubDate),
    url: j.url || j.jobUrl || "",
    description: plainText(j.jobDescription || ""),
    employment_type: j.jobType || "",
    salary_min: j.annualSalaryMin ?? "",
    salary_max: j.annualSalaryMax ?? "",
    salary_currency: j.salaryCurrency || "USD",
  });
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchJobicyJobs(_browser) {
  const tags = (config.searchQueries || [config.searchQ])
    .map((q) => String(q).slice(0, 50))
    .filter((t) => t.length >= 3);
  const seen = new Set();
  const jobs = [];
  let fetched = 0;

  console.log(`[jobicy] geos=${GEOS.join(",")} tags=${tags.length}`);

  for (const geo of GEOS) {
    for (const tag of tags.slice(0, 6)) {
      try {
        const url = `https://jobicy.com/api/v2/remote-jobs?count=100&geo=${encodeURIComponent(geo)}&tag=${encodeURIComponent(tag)}`;
        const json = await fetchJson(url);
        const list = json.jobs || [];
        fetched += list.length;
        for (const raw of list) {
          const mapped = mapJob(raw, geo);
          if (seen.has(mapped.id)) continue;
          seen.add(mapped.id);
          const kept = keepNormalizedJob(mapped);
          if (kept) jobs.push(kept);
        }
      } catch (err) {
        console.warn(`[jobicy] geo=${geo} tag="${tag}" failed: ${err.message}`);
      }
    }
  }

  console.log(`[jobicy] kept ${jobs.length} (fetched=${fetched})`);
  return { jobs };
}
