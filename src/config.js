import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const dataDir = path.resolve(root, process.env.DATA_DIR || "download");

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return String(raw).toLowerCase() !== "false";
}

function parseCsvList(raw, fallback) {
  const fromEnv = String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return fallback;
}

const DEFAULT_SEARCH_QUERIES = [
  "Software Engineer",
  "Backend Engineer",
  "AI Engineer",
  "ML Engineer",
  "Machine Learning Engineer",
  "AI/ML Engineer",
  "LLM Engineer",
  "Generative AI Engineer",
];

const DEFAULT_JOBRIGHT_TITLES = [
  "Software Engineer",
  "Backend Engineer",
  "AI Engineer",
  "ML Engineer",
  "Machine Learning Engineer",
  "AI/ML Engineer",
  "LLM Engineer",
  "Generative AI Engineer",
  "Senior Software Engineer",
  "Senior Backend Engineer",
  "Senior AI Engineer",
  "Senior ML Engineer",
];

const DEFAULT_GREENHOUSE_BOARDS = [
  "affirm",
  "stripe",
  "datadog",
  "notion",
  "figma",
  "hubspot",
  "twilio",
  "snowflakecomputing",
  "gitlab",
  "cloudflare",
  "doordash",
  "instacart",
  "asana",
  "coinbase",
  "gusto",
  "rippling",
  "ramp",
  "brex",
  "airbnb",
  "dropbox",
  "boxinc",
  "zendesk",
  "plaid",
  "calendly",
  "canva",
  "discord",
  "robinhood",
  "square",
  "block",
  "okta",
  "hashicorp",
  "databricks",
  "mongodb",
  "elastic",
  "confluent",
  "docusign",
  "smartsheet",
  "qualtrics",
  "surveymonkey",
  "duolingo",
  "grammarly",
  "coursera",
  "udemy",
  "khanacademy",
  "vanta",
  "mercury",
  "flexport",
  "shippo",
  "faire",
  "whatnot",
  "atlassian",
  "cultureamp",
  "safetyCulture",
  "employmenthero",
  "airwallex",
  "envato",
  "linktree",
  "immutable",
];

const DEFAULT_LEVER_COMPANIES = [
  "netflix",
  "spotify",
  "twitch",
  "palantir",
  "reddit",
  "shopify",
  "canva",
  "atlassian",
  "cultureamp",
  "airwallex",
  "envato",
  "immutable",
  "buildkite",
  "safetyCulture",
];

const DEFAULT_ASHBY_ORGS = [
  "openai",
  "anthropic",
  "linear",
  "vercel",
  "notion",
  "ramp",
  "rippling",
  "mercury",
  "canva",
  "airwallex",
];

export const config = {
  root,
  dataDir,
  /** Dual region CSVs (US / AU). */
  csvUsFile: process.env.CSV_US_FILE || "jobs_us_latest.csv",
  csvUsPath: path.join(
    dataDir,
    process.env.CSV_US_FILE || "jobs_us_latest.csv"
  ),
  csvAuFile: process.env.CSV_AU_FILE || "jobs_au_latest.csv",
  csvAuPath: path.join(
    dataDir,
    process.env.CSV_AU_FILE || "jobs_au_latest.csv"
  ),
  storePath: path.join(dataDir, process.env.STORE_FILE || "store.json"),
  dbPath: path.join(dataDir, process.env.STORE_FILE || "store.json"),
  slackWebhookUrl: String(process.env.SLACK_WEBHOOK_URL || "").trim(),
  port: Number(process.env.PORT || 3847),
  /** Primary query label (logging / API status). */
  searchQ: process.env.SEARCH_Q || "SWE Backend AI/ML",
  /**
   * Discovery queries for Dice / Built In / Monster / ZipRecruiter / Seek / public APIs.
   * Override with SEARCH_QUERIES (comma-separated).
   */
  searchQueries: parseCsvList(process.env.SEARCH_QUERIES, DEFAULT_SEARCH_QUERIES),
  maxPages: Math.max(1, Number(process.env.MAX_PAGES || 5)),
  /** Only capture/keep jobs posted within this many days. */
  recentDays: Math.max(1, Number(process.env.RECENT_DAYS || 3)),
  pageSize: Math.max(1, Math.min(100, Number(process.env.PAGE_SIZE || 20))),
  headless: bool("HEADLESS", true),
  delayMs: Math.max(0, Number(process.env.DELAY_MS || 800)),
  cronSchedule: process.env.CRON_SCHEDULE || "0 5,17 * * *",
  apiBase: `http://127.0.0.1:${Number(process.env.PORT || 3847)}`,

  // Existing scrapers
  captureDice: bool("CAPTURE_DICE", true),
  captureJobright: bool("CAPTURE_JOBRIGHT", true),
  captureBuiltin: bool("CAPTURE_BUILTIN", true),
  captureGreenhouse: bool("CAPTURE_GREENHOUSE", true),
  captureZiprecruiter: bool("CAPTURE_ZIPRECRUITER", true),
  captureMonster: bool("CAPTURE_MONSTER", true),

  // Public remote-job APIs (no auth)
  captureRemotive: bool("CAPTURE_REMOTIVE", true),
  captureJobicy: bool("CAPTURE_JOBICY", true),
  captureHimalayas: bool("CAPTURE_HIMALAYAS", true),
  captureArbeitnow: bool("CAPTURE_ARBEITNOW", true),
  captureRemoteok: bool("CAPTURE_REMOTEOK", true),

  // Public ATS boards
  captureLever: bool("CAPTURE_LEVER", true),
  captureAshby: bool("CAPTURE_ASHBY", true),

  // AU Playwright
  captureSeek: bool("CAPTURE_SEEK", true),

  greenhouseBoards: parseCsvList(
    process.env.GREENHOUSE_BOARDS,
    DEFAULT_GREENHOUSE_BOARDS
  ),
  leverCompanies: parseCsvList(
    process.env.LEVER_COMPANIES,
    DEFAULT_LEVER_COMPANIES
  ),
  ashbyOrgs: parseCsvList(process.env.ASHBY_ORGS, DEFAULT_ASHBY_ORGS),

  jobrightAuthPath: path.resolve(
    root,
    process.env.JOBRIGHT_AUTH_PATH || path.join("download", "jobright-auth.json")
  ),
  diceAuthPath: path.resolve(
    root,
    process.env.DICE_AUTH_PATH || path.join("download", "dice-auth.json")
  ),
  jobrightMaxPages: Math.max(
    1,
    Number(process.env.JOBRIGHT_MAX_PAGES || process.env.MAX_PAGES || 5)
  ),
  /**
   * JobRight search SEEDS (not title filters). Keep/skip is the capture rule.
   */
  jobrightTitles: parseCsvList(
    process.env.JOBRIGHT_TITLES,
    DEFAULT_JOBRIGHT_TITLES
  ),
};

/** Known capture source ids (used for status counts). */
export const SOURCE_IDS = [
  "remotive",
  "jobicy",
  "himalayas",
  "arbeitnow",
  "remoteok",
  "greenhouse",
  "lever",
  "ashby",
  "dice",
  "builtin",
  "ziprecruiter",
  "monster",
  "seek",
  "jobright",
];

/** CSV row order — JobRight last. */
export const CSV_SOURCE_ORDER = [
  "remotive",
  "jobicy",
  "himalayas",
  "arbeitnow",
  "remoteok",
  "greenhouse",
  "lever",
  "ashby",
  "dice",
  "builtin",
  "ziprecruiter",
  "monster",
  "seek",
  "jobright",
];

export const CSV_HEADERS = [
  "id",
  "title",
  "organization",
  "location",
  "work_arrangement",
  "remote_restricted_to",
  "region",
  "experience_level",
  "employment_type",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_unit",
  "key_skills",
  "source",
  "date_posted",
  "url",
  "description",
  "first_seen_run_id",
  "last_seen_run_id",
  "first_seen_at",
  "last_seen_at",
  "status",
];
