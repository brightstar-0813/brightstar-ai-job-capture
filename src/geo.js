/**
 * Classify remote jobs as US or AU for dual CSV export.
 * Ambiguous / worldwide-only listings return null (omit from both exports).
 */

const AU_CITY_RE =
  /\b(?:sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|gold\s+coast|newcastle|wollongong|geelong|cairns|darwin|australia|australian)\b/i;

const AU_CODE_RE = /\b(?:AU|AUS)\b/;

const US_STATE_RE =
  /\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s+hampshire|new\s+jersey|new\s+mexico|new\s+york|north\s+carolina|north\s+dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s+island|south\s+carolina|south\s+dakota|tennessee|texas|utah|vermont|virginia|washington|west\s+virginia|wisconsin|wyoming|district\s+of\s+columbia)\b/i;

const US_CODE_RE =
  /\b(?:USA|U\.S\.A\.|U\.S\.|United\s+States(?:\s+of\s+America)?)\b/i;

/** Standalone US (avoid matching in " thrUS ") — word boundary US. */
const US_SHORT_RE = /\bUS\b/;

/**
 * Infer remote_restricted_to label from free text when useful.
 * @returns {string}
 */
export function inferRemoteRestriction(text) {
  const region = classifyRegionFromText(text);
  if (region === "AU") return "Australia";
  if (region === "US") return "United States";
  return "";
}

/**
 * @param {string} text
 * @returns {"US"|"AU"|null}
 */
export function classifyRegionFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const hasAu = AU_CITY_RE.test(raw) || AU_CODE_RE.test(raw);
  const hasUs =
    US_CODE_RE.test(raw) ||
    US_STATE_RE.test(raw) ||
    (US_SHORT_RE.test(raw) && !/\baustria\b/i.test(raw));

  if (hasAu && !hasUs) return "AU";
  if (hasUs && !hasAu) return "US";
  if (hasAu && hasUs) {
    // Prefer the more specific restriction if one dominates
    if (/remote\s*[-–—:]?\s*(?:australia|au)\b/i.test(raw)) return "AU";
    if (/remote\s*[-–—:]?\s*(?:united\s+states|usa|us)\b/i.test(raw)) return "US";
    return null;
  }

  // Jobicy / Remotive style slugs
  const lower = raw.toLowerCase();
  if (/\b(?:apac|anz|oceania)\b/.test(lower) && !hasUs) {
    // APAC is broader than AU — only count as AU when Australia is named elsewhere
    if (hasAu) return "AU";
  }
  if (/\b(?:usa|united states|north america)\b/.test(lower)) return "US";

  return null;
}

/**
 * Classify a job into US or AU.
 * Prefers explicit job.region, then remote_restricted_to, then location (+ optional fields).
 * @param {{
 *   region?: string,
 *   remote_restricted_to?: string,
 *   location?: string,
 *   candidate_required_location?: string,
 *   geo?: string,
 *   country?: string,
 *   source?: string,
 * }} job
 * @returns {"US"|"AU"|null}
 */
export function classifyRegion(job) {
  if (!job) return null;

  const stamped = String(job.region || "").trim().toUpperCase();
  if (stamped === "US" || stamped === "AU") return stamped;

  const blobs = [
    job.remote_restricted_to,
    job.location,
    job.candidate_required_location,
    job.geo,
    job.country,
  ]
    .filter(Boolean)
    .join(" | ");

  const fromText = classifyRegionFromText(blobs);
  if (fromText) return fromText;

  // Source defaults when the board is country-scoped
  const src = String(job.source || "").toLowerCase();
  if (src === "seek") return "AU";
  if (
    src === "dice" ||
    src === "jobright" ||
    src === "builtin" ||
    src === "ziprecruiter" ||
    src === "monster"
  ) {
    return "US";
  }

  // Greenhouse / Lever / Ashby "Remote" with no country → treat as US-eligible
  // for this personal US/AU hunt (worldwide-only remotes still need a country cue).
  if (
    (src === "greenhouse" || src === "lever" || src === "ashby") &&
    /\bremote\b/i.test(blobs) &&
    !/\b(europe|emea|uk|united kingdom|canada|latam|india|asia)\b/i.test(blobs)
  ) {
    return "US";
  }

  return null;
}

/**
 * Ensure job has region + remote_restricted_to filled when classifiable.
 * Mutates and returns the job.
 */
export function applyRegionFields(job) {
  if (!job) return job;
  const region = classifyRegion(job);
  if (region) {
    job.region = region;
    if (!job.remote_restricted_to) {
      job.remote_restricted_to =
        region === "AU" ? "Australia" : "United States";
    }
  } else if (!job.region) {
    job.region = "";
  }
  return job;
}
