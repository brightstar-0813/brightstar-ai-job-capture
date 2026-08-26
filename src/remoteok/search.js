/**
 * RemoteOK public API — https://remoteok.com/api
 * First row is metadata; skip it.
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
  const location = j.location || (Array.isArray(j.tags) ? j.tags.join(", ") : "");
  return emptyJobFields({
    id: `remoteok_${j.id || j.slug}`,
    title: j.position || j.title || "",
    organization: j.company || "",
    location: String(location),
    work_arrangement: "Remote",
    remote_restricted_to: String(j.location || ""),
    key_skills: Array.isArray(j.tags) ? j.tags.join(", ") : "",
    source: "remoteok",
    date_posted: toIsoDate(j.date || (j.epoch ? j.epoch * 1000 : "")),
    url: j.url || j.apply_url || "",
    description: plainText(j.description || ""),
    salary_min: j.salary_min ?? "",
    salary_max: j.salary_max ?? "",
  });
}

function matchesQuery(job, queries) {
  const blob = `${job.title} ${job.description} ${job.key_skills}`.toLowerCase();
  return queries.some((q) => blob.includes(String(q).toLowerCase()));
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchRemoteokJobs(_browser) {
  const queries = config.searchQueries?.length
    ? config.searchQueries
    : [config.searchQ];
  const seen = new Set();
  const jobs = [];
  let fetched = 0;

  console.log(`[remoteok] fetching feed`);

  try {
    const list = await fetchJson("https://remoteok.com/api");
    if (!Array.isArray(list)) {
      console.warn("[remoteok] unexpected response shape");
      return { jobs: [] };
    }
    // First element is metadata
    const rows = list.slice(1);
    fetched = rows.length;
    for (const raw of rows) {
      if (!raw || raw.id == null) continue;
      const mapped = mapJob(raw);
      if (!mapped.url && raw.slug) {
        mapped.url = `https://remoteok.com/remote-jobs/${raw.slug}`;
      }
      if (seen.has(mapped.id)) continue;
      if (!matchesQuery(mapped, queries)) continue;
      seen.add(mapped.id);
      const kept = keepNormalizedJob(mapped);
      if (kept) jobs.push(kept);
    }
  } catch (err) {
    console.warn(`[remoteok] failed: ${err.message}`);
  }

  console.log(`[remoteok] kept ${jobs.length} (fetched=${fetched})`);
  return { jobs };
}
