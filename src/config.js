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
  "AI Engineer",
  "AI Developer",
  "Generative AI Engineer",
  "Full Stack AI Engineer",
  "Agentic AI Engineer",
  "LLM Engineer",
];

const DEFAULT_JOBRIGHT_TITLES = [
  "AI Engineer",
  "AI Developer",
  "Senior AI Engineer",
  "Full Stack AI Engineer",
  "Generative AI Engineer",
  "GenAI Engineer",
  "Agentic AI Engineer",
  "LLM Engineer",
  "Lead AI Engineer",
  "Principal AI Engineer",
];

export const config = {
  root,
  dataDir,
  /** Single combined CSV with latest jobs from all sources. */
  csvLatestFile: process.env.CSV_LATEST_FILE || "jobs_latest.csv",
  csvLatestPath: path.join(
    dataDir,
    process.env.CSV_LATEST_FILE || "jobs_latest.csv"
  ),
  storePath: path.join(dataDir, process.env.STORE_FILE || "store.json"),
  dbPath: path.join(dataDir, process.env.STORE_FILE || "store.json"),
  slackWebhookUrl: String(process.env.SLACK_WEBHOOK_URL || "").trim(),
  port: Number(process.env.PORT || 3847),
  /** Primary query label (logging / API status). */
  searchQ: process.env.SEARCH_Q || "AI Engineer",
  /**
   * Discovery queries for Dice / Built In / Monster / ZipRecruiter.
   * Discovery queries for AI Engineer / AI Developer family listings.
   * Override with SEARCH_QUERIES (comma-separated).
   */
  searchQueries: parseCsvList(process.env.SEARCH_QUERIES, DEFAULT_SEARCH_QUERIES),
  maxPages: Math.max(1, Number(process.env.MAX_PAGES || 5)),
  /** Extra discovery queries use fewer pages than the first query. */
  searchExtraPages: Math.max(1, Number(process.env.SEARCH_EXTRA_PAGES || 3)),
  /** Only capture/keep jobs posted within this many days (both sources). */
  recentDays: Math.max(1, Number(process.env.RECENT_DAYS || 3)),
  pageSize: Math.max(1, Math.min(100, Number(process.env.PAGE_SIZE || 20))),
  headless: bool("HEADLESS", true),
  delayMs: Math.max(0, Number(process.env.DELAY_MS || 800)),
  cronSchedule: process.env.CRON_SCHEDULE || "0 5,17 * * *",
  apiBase: `http://127.0.0.1:${Number(process.env.PORT || 3847)}`,
  captureDice: bool("CAPTURE_DICE", true),
  captureJobright: bool("CAPTURE_JOBRIGHT", true),
  captureBuiltin: bool("CAPTURE_BUILTIN", true),
  captureGreenhouse: bool("CAPTURE_GREENHOUSE", true),
  /** Often Cloudflare-blocked in headless — on by default but may yield 0. */
  captureZiprecruiter: bool("CAPTURE_ZIPRECRUITER", true),
  /** Often empty/blocked in headless — on by default but may yield 0. */
  captureMonster: bool("CAPTURE_MONSTER", true),
  /** Public JSON/RSS feeds — no browser. */
  captureRemotive: bool("CAPTURE_REMOTIVE", true),
  captureJobicy: bool("CAPTURE_JOBICY", true),
  captureRemoteok: bool("CAPTURE_REMOTEOK", true),
  captureWwr: bool("CAPTURE_WWR", true),
  captureHimalayas: bool("CAPTURE_HIMALAYAS", true),
  captureJobgether: bool("CAPTURE_JOBGETHER", true),
  captureArbeitnow: bool("CAPTURE_ARBEITNOW", true),
  captureThemuse: bool("CAPTURE_THEMUSE", true),
  captureWorkingnomads: bool("CAPTURE_WORKINGNOMADS", true),
  captureJobspresso: bool("CAPTURE_JOBSPRESSO", true),
  captureSkipthedrive: bool("CAPTURE_SKIPTHEDRIVE", true),
  captureArc: bool("CAPTURE_ARC", true),
  captureUsajobs: bool("CAPTURE_USAJOBS", true),
  captureAdzuna: bool("CAPTURE_ADZUNA", true),
  captureGooglejobs: bool("CAPTURE_GOOGLEJOBS", true),
  captureLever: bool("CAPTURE_LEVER", true),
  captureAshby: bool("CAPTURE_ASHBY", true),
  usajobsApiKey: String(process.env.USAJOBS_API_KEY || "").trim(),
  usajobsUserEmail: String(process.env.USAJOBS_USER_EMAIL || "").trim(),
  adzunaAppId: String(process.env.ADZUNA_APP_ID || "").trim(),
  adzunaAppKey: String(process.env.ADZUNA_APP_KEY || "").trim(),
  serpapiKey: String(process.env.SERPAPI_KEY || "").trim(),
  jobicyTags: parseCsvList(process.env.JOBICY_TAGS, [
    "ai",
    "llm",
    "machine-learning",
    "python",
  ]),
  /**
   * Greenhouse board tokens (boards.greenhouse.io/{token}). No global search —
   * we poll these company boards and keep remote AI Engineer matches.
   */
  greenhouseBoards: String(
    process.env.GREENHOUSE_BOARDS ||
      [
        "openai",
        "anthropic",
        "huggingface",
        "scale",
        "scaleai",
        "cohere",
        "mistral",
        "perplexity",
        "together",
        "togetherai",
        "groq",
        "modal",
        "wandb",
        "langchain",
        "stability",
        "replicate",
        "cerebras",
        "sambanova",
        "inflection",
        "character",
        "elevenlabs",
        "runway",
        "adept",
        "xai",
        "databricks",
        "snowflakecomputing",
        "datadog",
        "elastic",
        "mongodb",
        "confluent",
        "cloudflare",
        "gitlab",
        "hashicorp",
        "stripe",
        "twilio",
        "okta",
        "notion",
        "figma",
        "asana",
        "airtable",
        "miro",
        "intercom",
        "hubspot",
        "affirm",
        "ramp",
        "brex",
        "plaid",
        "mercury",
        "vanta",
        "gusto",
        "rippling",
        "coinbase",
        "robinhood",
        "block",
        "square",
        "airbnb",
        "doordash",
        "instacart",
        "lyft",
        "dropbox",
        "boxinc",
        "zendesk",
        "calendly",
        "canva",
        "discord",
        "reddit",
        "pinterest",
        "duolingo",
        "grammarly",
        "coursera",
        "udemy",
        "khanacademy",
        "smartsheet",
        "qualtrics",
        "surveymonkey",
        "docusign",
        "flexport",
        "shippo",
        "faire",
        "whatnot",
        "sentry",
        "launchdarkly",
        "fullstory",
        "amplitude",
        "mixpanel",
        "gong",
        "clari",
        "outreach",
        "braze",
        "iterable",
        "klaviyo",
        "crowdstrike",
        "samsara",
        "spotify",
        "adobe",
        "intuit",
        "paypal",
        "sofi",
        "chime",
        "slack",
        "heroku",
        "mulesoft",
        "tableau",
        "workato",
        "celigo",
        "epam",
        "thoughtworks",
        "globant",
      ].join(",")
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * Lever company tokens (jobs.lever.co/{token}).
   */
  leverBoards: parseCsvList(process.env.LEVER_BOARDS, [
    "openai",
    "anthropic",
    "huggingface",
    "scaleai",
    "cohere",
    "mistral",
    "together",
    "groq",
    "modal",
    "wandb",
    "langchain",
    "stability",
    "replicate",
    "cerebras",
    "databricks",
    "snowflake",
    "gitlab",
    "cloudflare",
    "datadog",
    "stripe",
    "twilio",
    "zendesk",
    "okta",
    "hubspot",
    "notion",
    "figma",
    "canva",
    "vercel",
    "linear",
    "palantir",
    "anduril",
    "posthog",
    "loom",
    "netflix",
    "airbnb",
    "coinbase",
    "robinhood",
    "plaid",
    "brex",
    "ramp",
    "gusto",
    "rippling",
    "intercom",
    "asana",
    "gong",
    "clari",
    "outreach",
    "docusign",
    "workato",
  ]),
  /**
   * Ashby job-board tokens (jobs.ashbyhq.com/{token}).
   */
  ashbyBoards: parseCsvList(process.env.ASHBY_BOARDS, [
    "openai",
    "anthropic",
    "huggingface",
    "scale",
    "cohere",
    "mistral",
    "perplexity",
    "together",
    "groq",
    "modal",
    "wandb",
    "langchain",
    "stability",
    "replicate",
    "databricks",
    "snowflake",
    "notion",
    "linear",
    "vercel",
    "ramp",
    "rippling",
    "vanta",
    "mercury",
    "brex",
    "plaid",
    "asana",
    "figma",
    "canva",
    "intercom",
    "gong",
    "clari",
    "outreach",
  ]),
  jobrightAuthPath: path.resolve(
    root,
    process.env.JOBRIGHT_AUTH_PATH || path.join("download", "jobright-auth.json")
  ),
  diceAuthPath: path.resolve(
    root,
    process.env.DICE_AUTH_PATH || path.join("download", "dice-auth.json")
  ),
  jobrightMaxPages: Math.max(1, Number(process.env.JOBRIGHT_MAX_PAGES || process.env.MAX_PAGES || 5)),
  /**
   * JobRight search SEEDS (not title filters). Keep/skip is the capture
   * rule: remote + AI Engineer/Developer-family title.
   */
  jobrightTitles: parseCsvList(
    process.env.JOBRIGHT_TITLES,
    DEFAULT_JOBRIGHT_TITLES
  ),
};

export function pagesForSearchQuery(index) {
  return Number(index) === 0 ? config.maxPages : config.searchExtraPages;
}

/** Known capture source ids (used for status counts). */
export const SOURCE_IDS = [
  "builtin",
  "himalayas",
  "greenhouse",
  "dice",
  "lever",
  "ashby",
  "remotive",
  "jobicy",
  "remoteok",
  "wwr",
  "jobgether",
  "arbeitnow",
  "themuse",
  "workingnomads",
  "jobspresso",
  "skipthedrive",
  "arc",
  "usajobs",
  "adzuna",
  "googlejobs",
  "ziprecruiter",
  "monster",
  "jobright",
];

/** CSV row order — JobRight last so those jobs sit at the bottom of jobs_latest.csv. */
export const CSV_SOURCE_ORDER = [
  "dice",
  "builtin",
  "himalayas",
  "greenhouse",
  "lever",
  "ashby",
  "remotive",
  "jobicy",
  "remoteok",
  "wwr",
  "jobgether",
  "themuse",
  "workingnomads",
  "jobspresso",
  "skipthedrive",
  "arc",
  "arbeitnow",
  "usajobs",
  "adzuna",
  "googlejobs",
  "ziprecruiter",
  "monster",
  "jobright",
];

export const CSV_HEADERS = [
  "id",
  "title",
  "organization",
  "location",
  "work_arrangement",
  "remote_restricted_to",
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
