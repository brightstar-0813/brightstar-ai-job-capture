/**
 * Capture rule: remote AI Engineer / AI Developer family only.
 *
 * Gold-standard titles look like the Fantastic Jobs sample: AI Engineer,
 * Senior AI Engineer, Full Stack AI Engineer, AI Developer, GenAI / Agentic
 * AI Engineer, LLM Engineer. Exact wording is not required.
 *
 * Generic software/ML titles are skipped even if the JD mentions AI.
 * Non-eng "AI" titles (sales, recruiting, PM) are skipped.
 */

const AI_FAMILY_RE =
  /\b(?:gen(?:erative)?[\s-]?ai|agentic[\s-]?ai|llms?|a\.i\.)\b|\bai\b/i;

const ENG_OR_DEV_RE = /\b(engineers?|developers?)\b/i;

const NOT_AI_ENG_TITLE_RE =
  /\b(account executive|sales|recruiter|recruiting|sourcer|customer success|marketing|product manager|program manager|project manager|designer|writer|intern(?!al)|teacher|instructor)\b/i;

/**
 * Title is an AI Engineer / AI Developer (or close variant). JD is ignored
 * so a backend SWE with "we use AI" in the description is not kept.
 */
export function containsAi(title, _description) {
  const t = String(title || "");
  if (!t.trim()) return false;
  if (NOT_AI_ENG_TITLE_RE.test(t)) return false;
  return AI_FAMILY_RE.test(t) && ENG_OR_DEV_RE.test(t);
}

/**
 * Remote-only: keep fully remote roles, drop hybrid and on-site.
 * An empty value is treated as remote only because Dice search is already
 * restricted to Remote (detail pages often omit workplace type). Any explicit
 * hybrid / on-site / in-office label is rejected; otherwise the value must
 * mention "remote".
 */
export function isRemoteArrangement(workArrangement) {
  const w = String(workArrangement || "").toLowerCase().trim();
  if (!w) return true;
  if (/hybrid/.test(w)) return false;
  if (/on[-\s]?site|onsite|in[-\s]?office|in[-\s]?person/.test(w)) return false;
  return /\bremote\b/.test(w);
}

/**
 * Final capture decision: AI Engineer/Developer-family title + remote.
 * @param {{ title?: string, description?: string, organization?: string, work_arrangement?: string }} job
 */
export function matchesCaptureRule(job) {
  if (!job) return false;
  if (!isRemoteArrangement(job.work_arrangement)) return false;
  return containsAi(job.title, job.description);
}

export function filterAiJobs(jobs) {
  return (jobs || []).filter((j) => matchesCaptureRule(j));
}

export function isLinkedinLink(...links) {
  return links.some((l) => /linkedin\.com/i.test(String(l || "")));
}

const US_RE = /\b(united states|usa|u\.s\.a\.?|u\.s\.)\b/;
const CANADA_RE =
  /\b(canada|canadian|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|toronto|vancouver|montreal|ottawa|calgary|edmonton)\b/;
const OTHER_REGION_RE =
  /\b(uk|united kingdom|germany|france|india|emea|apac|australia|netherlands|spain|brazil|mexico|latam|latin america|poland|ireland)\b/;

/**
 * US remote only. Drop Canada-only and other-region-only postings.
 * "US or Canada" still counts as US-eligible. Empty location is kept
 * (Dice/JobRight searches are already US-scoped).
 */
export function isUsFriendlyLocation(location, title = "") {
  const s = `${location || ""} ${title || ""}`.toLowerCase().trim();
  if (!s) return true;
  const hasUs = US_RE.test(s);
  if (CANADA_RE.test(s) && !hasUs) return false;
  if (hasUs) return true;
  if (
    /\b(worldwide|anywhere|global|north america|americas)\b/.test(s) &&
    !/\b(emea|europe|india|uk[- ]only|latam)\b/.test(s)
  ) {
    return true;
  }
  if (/^remote\b/.test(s) && !/\b(emea|europe|india|uk|latam|apac)\b/.test(s)) {
    return true;
  }
  if (OTHER_REGION_RE.test(s)) return false;
  return true;
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse a job's posted date into an absolute Date. Handles:
 * - epoch ms (13 digits) / epoch seconds (10 digits)
 * - ISO / RFC date strings (Date.parse)
 * - relative English ("today", "just posted", "yesterday",
 *   "3 days ago", "2 weeks ago", "1 month ago", "5 hours ago")
 * Relative strings are resolved against `now` (the scrape time), so callers
 * should normalize to an absolute value at capture time.
 * @returns {Date|null} null when the value can't be understood.
 */
export function parsePostedDate(value, now = new Date()) {
  if (value == null || value === "") return null;

  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim().toLowerCase();

  if (/(^|\b)(just posted|today|moments? ago|minutes? ago|hours? ago|<\s*1\s*day)/.test(s)) {
    return now;
  }
  if (/\byesterday\b/.test(s)) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  const rel = s.match(/(\d+)\+?\s*(hour|day|week|month|year)s?\s*ago/);
  if (rel) {
    const qty = Number(rel[1]);
    const unitMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    }[rel[2]];
    return new Date(now.getTime() - qty * unitMs);
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

/**
 * True when `value` resolves to within the last `days` days; false when older;
 * null when the date can't be parsed (caller decides how to treat unknowns).
 */
export function isWithinRecentDays(value, days, now = new Date()) {
  const d = parsePostedDate(value, now);
  if (!d) return null;
  const ageMs = now.getTime() - d.getTime();
  if (ageMs < 0) return true; // future-dated (clock skew) — treat as fresh
  return ageMs <= days * 24 * 60 * 60 * 1000;
}

/**
 * Recency decision for a stored/scraped job. Uses date_posted; when that is
 * missing/unparseable, falls back to first_seen_at so legacy rows still age
 * out. Jobs with no usable date at all are kept (lenient).
 */
export function isRecentJob(job, days, now = new Date()) {
  if (!job) return false;
  const byPosted = isWithinRecentDays(job.date_posted, days, now);
  if (byPosted !== null) return byPosted;
  const bySeen = isWithinRecentDays(job.first_seen_at, days, now);
  if (bySeen !== null) return bySeen;
  return true;
}
