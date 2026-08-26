/**
 * Remotive public API — https://remotive.com/api/remote-jobs
 * Attribution: job data from Remotive.com
 */

import { config } from "../config.js";
import {
  fetchJson,
  plainText,
  toIsoDate,
  keepNormalizedJob,
  emptyJobFields,
} from "../sources/normalize.js";

function mapJob(j) {
  const location = j.candidate_required_location || "";
  const regionHint = /united states|\busa\b|\bus\b|america/i.test(location)
    ? "US"
    : /australia|\bau\b/i.test(location)
      ? "AU"
      : "";
  return emptyJobFields({
    id: `remotive_${j.id}`,
    title: j.title || "",
    organization: j.company_name || "",
    location: String(location),
    work_arrangement: "Remote",
    remote_restricted_to: String(location),
    region: regionHint,
    key_skills: Array.isArray(j.tags) ? j.tags.join(", ") : "",
    source: "remotive",
    date_posted: toIsoDate(j.publication_date),
    url: j.url || "",
    description: plainText(j.description || ""),
    salary_min: "",
    salary_max: "",
    employment_type: j.job_type || "",
  });
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchRemotiveJobs(_browser) {
  const queries = config.searchQueries?.length
    ? config.searchQueries
    : [config.searchQ];
  const seen = new Set();
  const jobs = [];
  let fetched = 0;

  console.log(`[remotive] searching ${queries.length} queries`);

  for (const q of queries) {
    try {
      const url = `https://remotive.com/api/remote-jobs?category=software-dev&search=${encodeURIComponent(q)}`;
      const json = await fetchJson(url);
      const list = json.jobs || [];
      fetched += list.length;
      for (const raw of list) {
        const mapped = mapJob(raw);
        if (!mapped.url) mapped.url = `https://remotive.com/remote-jobs/${raw.id}`;
        if (seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        const kept = keepNormalizedJob(mapped);
        if (kept) jobs.push(kept);
      }
    } catch (err) {
      console.warn(`[remotive] query "${q}" failed: ${err.message}`);
    }
  }

  console.log(`[remotive] kept ${jobs.length} (fetched=${fetched})`);
  return { jobs };
}
