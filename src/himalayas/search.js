/**
 * Himalayas public API — https://himalayas.app/jobs/api/search
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
  const countries = Array.isArray(j.countries)
    ? j.countries.map((c) => c.name || c).join(", ")
    : "";
  const location =
    countries ||
    (Array.isArray(j.locationRestrictions)
      ? j.locationRestrictions.join(", ")
      : "") ||
    (j.worldwide ? "Worldwide" : "");

  return emptyJobFields({
    id: `himalayas_${j.id || j.slug || j.guid}`,
    title: j.title || "",
    organization: j.companyName || j.company?.name || "",
    location,
    work_arrangement: "Remote",
    remote_restricted_to: location,
    key_skills: Array.isArray(j.categories)
      ? j.categories.map((c) => c.name || c).join(", ")
      : "",
    source: "himalayas",
    date_posted: toIsoDate(j.pubDate || j.publishedAt || j.updatedAt),
    url: j.applicationLink || j.url || j.guid || "",
    description: plainText(j.description || j.excerpt || ""),
    employment_type: Array.isArray(j.employmentType)
      ? j.employmentType.join(", ")
      : String(j.employmentType || ""),
    salary_min: j.minSalary ?? "",
    salary_max: j.maxSalary ?? "",
    salary_currency: j.currency || "USD",
  });
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchHimalayasJobs(_browser) {
  const queries = config.searchQueries?.length
    ? config.searchQueries
    : [config.searchQ];
  const countries = ["United States", "Australia"];
  const seen = new Set();
  const jobs = [];
  let fetched = 0;

  console.log(`[himalayas] queries=${queries.length} countries=${countries.join(",")}`);

  for (const country of countries) {
    for (const q of queries.slice(0, 6)) {
      try {
        const params = new URLSearchParams({
          q: q,
          country,
          page: "1",
        });
        const url = `https://himalayas.app/jobs/api/search?${params}`;
        const json = await fetchJson(url);
        const list = json.jobs || json.data || [];
        fetched += list.length;
        for (const raw of list) {
          const mapped = mapJob(raw);
          if (!mapped.id || mapped.id === "himalayas_undefined") continue;
          if (seen.has(mapped.id)) continue;
          seen.add(mapped.id);
          // Prefer search country when location is vague
          if (!mapped.remote_restricted_to || /worldwide/i.test(mapped.location)) {
            mapped.remote_restricted_to = country;
            mapped.location = mapped.location
              ? `${mapped.location} | ${country}`
              : country;
          }
          const kept = keepNormalizedJob(mapped);
          if (kept) jobs.push(kept);
        }
      } catch (err) {
        console.warn(
          `[himalayas] country=${country} q="${q}" failed: ${err.message}`
        );
      }
    }
  }

  console.log(`[himalayas] kept ${jobs.length} (fetched=${fetched})`);
  return { jobs };
}
