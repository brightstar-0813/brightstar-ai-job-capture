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
 * Final capture decision: US location + remote + AI Engineer/Developer title.
 * @param {{ title?: string, description?: string, organization?: string, work_arrangement?: string, location?: string, source?: string }} job
 */
export function matchesCaptureRule(job) {
  if (!job) return false;
  if (!isRemoteArrangement(job.work_arrangement)) return false;
  if (!isUsJobLocation(job)) return false;
  return containsAi(job.title, job.description);
}

export function filterAiJobs(jobs) {
  return (jobs || []).filter((j) => matchesCaptureRule(j));
}

export function isLinkedinLink(...links) {
  return links.some((l) => /linkedin\.com/i.test(String(l || "")));
}

/** Searches already restricted to the United States. A blank or plain "Remote" location is still US. */
const US_SCOPED_SOURCES = new Set([
  "dice",
  "jobright",
  "builtin",
  "usajobs",
  "adzuna",
  "googlejobs",
]);

const US_STATE_RE =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|d\.c\.)\b/;

const US_POSTAL_RE =
  /,\s*(al|ak|az|ar|ca|co|ct|dc|de|fl|ga|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|va|vt|wa|wi|wv|wy)\b/;

const NON_US_RE =
  /\b(canada|canadian|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|toronto|vancouver|montreal|ottawa|calgary|edmonton|uk|united kingdom|england|scotland|wales|germany|france|india|emea|apac|australia|netherlands|spain|brazil|mexico|latam|latin america|poland|ireland|europe|european|singapore|japan|china|philippines|portugal|italy|sweden|norway|denmark|israel|uae|dubai|africa|new zealand|south africa|romania|ukraine|belgium|austria|switzerland|colombia|argentina|chile|worldwide|anywhere|global|north america|americas)\b/;

function locationText(location, title) {
  return `${location || ""} ${title || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasUsSignal(location, title) {
  const loc = String(location || "").toLowerCase();
  const titled = String(title || "").toLowerCase();
  const both = `${loc} ${titled}`;
  if (/\b(united states|u\.s\.a\.?|u\.s\.|usa)\b/.test(both)) return true;
  if (US_STATE_RE.test(both) || US_POSTAL_RE.test(both)) return true;
  if (/\bus\b/.test(loc)) return true;
  return /\b((remote|based|located)\s*[-–,/]?\s*us|us\s*[-–,/]?\s*remote|in the us|\(\s*us\s*\))\b/.test(
    titled
  );
}

function isGenericRemoteLocation(location) {
  const s = String(location || "").toLowerCase().trim();
  if (!s) return true;
  return /^(remote|fully remote|100%\s*remote|work from home|wfh)(\s*only)?$/.test(s);
}

/**
 * True when the posting is in the United States.
 * "US or Canada" stays (a US candidate can take it). Canada-only, UK, EMEA,
 * worldwide, and a plain "Remote" with no country are dropped.
 * Blank or plain "Remote" is kept only for sources whose search is already US-scoped.
 * @param {{ location?: string, title?: string, source?: string }} job
 */
export function isUsJobLocation(job) {
  const location = job?.location;
  const title = job?.title;
  const source = String(job?.source || "").toLowerCase();
  const text = locationText(location, title);
  if (!text) return US_SCOPED_SOURCES.has(source);
  const us = hasUsSignal(location, title);
  if (NON_US_RE.test(text) && !us) return false;
  if (us) return true;
  if (isGenericRemoteLocation(location) && US_SCOPED_SOURCES.has(source)) return true;
  return false;
}

/** @deprecated use isUsJobLocation */
export function isUsFriendlyLocation(location, title = "", source = "") {
  return isUsJobLocation({ location, title, source });
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
