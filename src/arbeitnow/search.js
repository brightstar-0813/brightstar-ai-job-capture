/**
 * Arbeitnow public job-board API — https://www.arbeitnow.com/api/job-board-api
 */

import {
  fetchJson,
  plainText,
  toIsoDate,
  keepNormalizedJob,
  emptyJobFields,
} from "../sources/normalize.js";

function mapJob(j) {
  const tags = Array.isArray(j.tags) ? j.tags : [];
  const location = j.location || "";
  const remote =
    j.remote === true ||
    tags.some((t) => /remote/i.test(String(t))) ||
    /\bremote\b/i.test(location);

  return emptyJobFields({
    id: `arbeitnow_${j.slug || j.url || j.title}`,
    title: j.title || "",
    organization: j.company_name || "",
    location,
    work_arrangement: remote ? "Remote" : "Onsite",
    remote_restricted_to: location,
    key_skills: tags.join(", "),
    source: "arbeitnow",
    date_posted: toIsoDate(
      j.created_at
        ? new Date(Number(j.created_at) * 1000).toISOString()
        : j.created_at
    ),
    url: j.url || "",
    description: plainText(j.description || ""),
  });
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchArbeitnowJobs(_browser) {
  const seen = new Set();
  const jobs = [];
  let fetched = 0;
  let page = 1;
  const maxPages = 5;

  console.log(`[arbeitnow] scanning up to ${maxPages} pages`);

  while (page <= maxPages) {
    try {
      const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`;
      const json = await fetchJson(url);
      const list = json.data || [];
      if (!list.length) break;
      fetched += list.length;
      for (const raw of list) {
        const mapped = mapJob(raw);
        if (seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        const kept = keepNormalizedJob(mapped);
        if (kept) jobs.push(kept);
      }
      if (!json.links?.next) break;
      page += 1;
    } catch (err) {
      console.warn(`[arbeitnow] page ${page} failed: ${err.message}`);
      break;
    }
  }

  console.log(`[arbeitnow] kept ${jobs.length} (fetched=${fetched})`);
  return { jobs };
}
