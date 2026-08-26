/**
 * Shared helpers for public JSON job APIs.
 */

import {
  matchesTargetRole,
  isRemoteArrangement,
  isWithinRecentDays,
  parsePostedDate,
  stripHtml,
} from "../filter.js";
import { applyRegionFields } from "../geo.js";
import { config } from "../config.js";

export function toIsoDate(value) {
  const d = parsePostedDate(value);
  return d ? d.toISOString().slice(0, 10) : String(value || "");
}

export function plainText(htmlOrText) {
  return stripHtml(htmlOrText || "");
}

/**
 * Keep remote + target role + recent jobs; stamp region.
 * Drops jobs with no classifiable US/AU region.
 */
export function keepNormalizedJob(job) {
  if (!job?.id || !job.title) return null;
  if (!isRemoteArrangement(job.work_arrangement)) return null;
  if (!matchesTargetRole(job)) return null;
  if (isWithinRecentDays(job.date_posted, config.recentDays) === false) {
    return null;
  }
  applyRegionFields(job);
  if (job.region !== "US" && job.region !== "AU") return null;
  return job;
}

export async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "ai-ml-be-job-capture/1.0 (personal job hunt; +https://github.com/local)",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function emptyJobFields(overrides) {
  return {
    experience_level: "",
    employment_type: "",
    salary_min: "",
    salary_max: "",
    salary_currency: "USD",
    salary_unit: "",
    key_skills: "",
    remote_restricted_to: "",
    region: "",
    work_arrangement: "Remote",
    ...overrides,
  };
}
