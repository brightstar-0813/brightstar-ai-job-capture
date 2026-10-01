import { config } from "../config.js";
import {
  containsAi,
  isRemoteArrangement,
  isUsFriendlyLocation,
  isWithinRecentDays,
  parsePostedDate,
  isLinkedinLink,
} from "../filter.js";

export function emptySkipCounts() {
  return { nonRemote: 0, location: 0, nonAi: 0, stale: 0 };
}

export function isoDate(value) {
  const d = parsePostedDate(value);
  return d ? d.toISOString().slice(0, 10) : String(value || "");
}

/**
 * Shared keep/drop for JSON/RSS/ATS feed jobs. Mutates `counts`.
 */
export function keepFeedJob(job, counts, { skipRecency = false } = {}) {
  if (!isRemoteArrangement(job.work_arrangement)) {
    counts.nonRemote += 1;
    return false;
  }
  if (!isUsFriendlyLocation(job.location, job.title)) {
    counts.location += 1;
    return false;
  }
  if (!containsAi(job.title, job.description)) {
    counts.nonAi += 1;
    return false;
  }
  if (isLinkedinLink(job.url)) {
    counts.stale += 1;
    return false;
  }
  if (
    !skipRecency &&
    isWithinRecentDays(job.date_posted, config.recentDays) === false
  ) {
    counts.stale += 1;
    return false;
  }
  return true;
}

export function logKept(source, kept, scanned, counts) {
  console.log(
    `[${source}] kept ${kept} remote AI jobs` +
      ` (scanned=${scanned},` +
      ` non-remote=${counts.nonRemote}, location=${counts.location},` +
      ` non-AI=${counts.nonAi}, stale=${counts.stale})`
  );
}
