/**
 * Capture rule: remote Software Engineer, AI-focused Backend Engineer,
 * or AI/ML Engineer (title and/or strong JD keywords).
 *
 * Exclude Data Engineer / Salesforce / Frontend and non-eng "AI" titles.
 */

const FRONTEND_TITLE_RE =
  /\b(?:front[\s-]?end|frontend|ui|ux|client[\s-]?side|react|angular|vue|svelte)\s+(?:engineers?|developers?)\b|\b(?:engineers?|developers?)\s*[,/-]\s*front[\s-]?end\b|\bfront[\s-]?end\s+(?:engineers?|developers?)\b/i;

const SWE_TITLE_RE = /\bsoftware\s+engineers?\b/i;

const BACKEND_TITLE_RE =
  /\b(?:back[\s-]?end|backend|server[\s-]?side)\s+engineers?\b/i;

const AIML_TITLE_RE =
  /\b(?:gen(?:erative)?[\s-]?ai|agentic[\s-]?ai|llms?|a\.?i\.?|ai[\s/:-]?ml|machine[\s-]?learning|ml)\b.*\b(?:engineers?|developers?)\b|\b(?:engineers?|developers?)\b.*\b(?:gen(?:erative)?[\s-]?ai|agentic[\s-]?ai|llms?|a\.?i\.?|ai[\s/:-]?ml|machine[\s-]?learning|\bml\b)\b|\b(?:ai|ml|llm|genai)[\s/-]*(?:engineers?|developers?)\b/i;

const ENG_OR_DEV_TITLE_RE =
  /\b(?:software|back[\s-]?end|backend|full[\s-]?stack|platform)?\s*(?:engineers?|developers?)\b/i;

/** Strong AI/ML signals for JD (and title) — prefer stack/domain tokens over bare "ai". */
const AI_SIGNAL_RE =
  /\b(?:gen(?:erative)?[\s-]?ai|agentic[\s-]?ai|llms?|large[\s-]?language[\s-]?models?|machine[\s-]?learning|deep[\s-]?learning|mlops|pytorch|tensorflow|langchain|llamaindex|rag\b|retrieval[\s-]?augmented|neural[\s-]?nets?|transformers?\b|nlp\b|computer[\s-]?vision|reinforcement[\s-]?learning|foundation[\s-]?models?)\b|\bai[\s/:-]?ml\b/i;

const AI_FAMILY_IN_TITLE_RE =
  /\b(?:gen(?:erative)?[\s-]?ai|agentic[\s-]?ai|llms?|a\.i\.|ai[\s/:-]?ml|machine[\s-]?learning|\bml\b|\bai\b)\b/i;

const EXCLUDE_TITLE_RE =
  /\b(?:data\s+engineers?|\bde\b\s+engineers?|salesforce|sales\s+cloud|sfdc|account\s+executive|sales\b|recruiter|recruiting|sourcer|customer\s+success|marketing|product\s+manager|program\s+manager|project\s+manager|designer|writer|intern(?!al)|teacher|instructor)\b/i;

/**
 * @deprecated Prefer matchesTargetRole — kept for older call sites.
 */
export function containsAi(title, description) {
  return matchesTargetRole({ title, description, work_arrangement: "Remote" });
}

/**
 * Title / JD role families we keep.
 * @param {{ title?: string, description?: string }} job
 */
export function matchesTargetRole(job) {
  const title = String(job?.title || "");
  const description = String(job?.description || "");
  if (!title.trim()) return false;
  if (EXCLUDE_TITLE_RE.test(title)) return false;
  if (FRONTEND_TITLE_RE.test(title)) return false;

  // 1) Explicit Software Engineer title
  if (SWE_TITLE_RE.test(title)) return true;

  // 2) AI/ML Engineer family in title
  if (AIML_TITLE_RE.test(title)) return true;
  if (AI_FAMILY_IN_TITLE_RE.test(title) && /\b(?:engineers?|developers?)\b/i.test(title)) {
    return true;
  }

  // 3) Backend Engineer + AI signal in title or JD
  if (BACKEND_TITLE_RE.test(title)) {
    if (AI_SIGNAL_RE.test(title) || AI_FAMILY_IN_TITLE_RE.test(title)) return true;
    if (AI_SIGNAL_RE.test(description)) return true;
    return false;
  }

  // 4) Engineer/Developer title + strong JD AI/ML keywords
  if (ENG_OR_DEV_TITLE_RE.test(title) && AI_SIGNAL_RE.test(description)) {
    return true;
  }

  return false;
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
 * Final capture decision: target role family + remote.
 * @param {{ title?: string, description?: string, organization?: string, work_arrangement?: string }} job
 */
export function matchesCaptureRule(job) {
  if (!job) return false;
  if (!isRemoteArrangement(job.work_arrangement)) return false;
  return matchesTargetRole(job);
}

export function filterAiJobs(jobs) {
  return (jobs || []).filter((j) => matchesCaptureRule(j));
}

export function isLinkedinLink(...links) {
  return links.some((l) => /linkedin\.com/i.test(String(l || "")));
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

/** Strip HTML to plain text for JD keyword matching. */
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
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
