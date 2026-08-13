/**
 * Capture rule for AI-engineer–related roles.
 *
 * Titles do NOT need to say "AI Engineer" exactly. Keep when either:
 *  1) Title looks like a related AI/ML/LLM role (LLM Engineer, ML Engineer,
 *     Generative AI, Applied Scientist, "Software Engineer, AI/ML", …), OR
 *  2) Title is an eng/scientist-style role AND the JD describes AI eng work
 *     (LLMs, RAG, fine-tuning, GenAI, MLOps, …).
 *
 * Bare marketing "AI" on non-eng titles (e.g. sales / recruiting) is skipped.
 */

/** Strong related-title phrases (exact "AI Engineer" not required). */
const AI_TITLE_STRONG_RE = new RegExp(
  [
    String.raw`\bLLMs?\b`,
    String.raw`\bGenAI\b`,
    String.raw`\bNLP\b`,
    String.raw`\bMLOps\b`,
    String.raw`\bRAG\b`,
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "generative[\\s-]?ai",
    "large language model",
    "computer vision",
    "prompt engineer",
    "foundation model",
    "applied scientist",
    "ai[\\s/-]?ml",
    "ml[\\s/-]?ai",
    "ai engineer",
    "ml engineer",
    "llm engineer",
    "mlops engineer",
  ].join("|"),
  "i"
);

/** Short tokens — only count when the title is also eng/scientist-style. */
const AI_TITLE_TOKEN_RE = /\b(?:AI|A\.I\.|ML)\b/i;

/** Stronger AI-engineering work signals in title or JD. */
const AI_ENG_WORK_RE = new RegExp(
  [
    String.raw`\bLLMs?\b`,
    String.raw`\bGenAI\b`,
    String.raw`\bRAG\b`,
    String.raw`\bMLOps\b`,
    String.raw`\bNLP\b`,
    "large language model",
    "generative[\\s-]?ai",
    "foundation model",
    "fine[\\s-]?tun(?:e|ing)",
    "retrieval[\\s-]?augmented",
    "prompt engineer(?:ing)?",
    "machine learning",
    "deep learning",
    "computer vision",
    "neural network",
    "transformer model",
    "diffusion model",
    "reinforcement learning",
    String.raw`\bRLHF\b`,
    "vector (?:db|database|store|embedding)",
    "embedding model",
    String.raw`\bLangChain\b`,
    String.raw`\bLlamaIndex\b`,
    String.raw`\bHugging\s?Face\b`,
    String.raw`\bPyTorch\b`,
    String.raw`\bTensorFlow\b`,
    "ai engineer",
    "ml engineer",
    "llm engineer",
    "mlops engineer",
  ].join("|"),
  "i"
);

/** Eng / applied-science style titles — needed for short-token or JD-only matches. */
const ENG_OR_SCIENCE_TITLE_RE =
  /\b(engineer|developer|scientist|researcher|architect|swe|sde|programmer|mlops)\b/i;

/**
 * True when title/JD indicate an AI-engineer–related role (exact title
 * "AI Engineer" is not required).
 */
export function containsAi(title, description) {
  const t = String(title || "");
  const d = String(description || "");

  // e.g. "LLM Engineer", "Staff ML Engineer", "Software Engineer, Generative AI"
  if (AI_TITLE_STRONG_RE.test(t)) return true;

  // e.g. "AI Platform Engineer", "ML Software Developer" — not "AI Account Exec"
  if (AI_TITLE_TOKEN_RE.test(t) && ENG_OR_SCIENCE_TITLE_RE.test(t)) return true;

  // e.g. "Senior Software Engineer" whose JD is LLM / RAG / fine-tuning work
  if (ENG_OR_SCIENCE_TITLE_RE.test(t) && AI_ENG_WORK_RE.test(d)) return true;

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
 * Final capture decision: AI-engineer–related (flexible title) + remote.
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
