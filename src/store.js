import fs from "fs";
import path from "path";
import { config, CSV_HEADERS, SOURCE_IDS, CSV_SOURCE_ORDER } from "./config.js";
import { writeCsv } from "./csv.js";
import { matchesCaptureRule, isRecentJob } from "./filter.js";
import { applyRegionFields, classifyRegion } from "./geo.js";

/**
 * Qualifies for CSV when capture rule + recent + US/AU region.
 */
function matchesOutputRule(job) {
  if (!matchesCaptureRule(job)) return false;
  if (!isRecentJob(job, config.recentDays)) return false;
  const region = classifyRegion(job);
  return region === "US" || region === "AU";
}

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function storeFilePath() {
  return config.storePath || path.join(config.dataDir, "store.json");
}

function defaultStore() {
  return { meta: {}, nextRunId: 1, runs: [], jobs: {} };
}

let cache = null;

function load() {
  if (cache) return cache;
  ensureDataDir();
  const p = storeFilePath();
  if (!fs.existsSync(p)) {
    cache = defaultStore();
    save();
    return cache;
  }
  try {
    cache = { ...defaultStore(), ...JSON.parse(fs.readFileSync(p, "utf8")) };
    cache.meta = cache.meta || {};
    cache.jobs = cache.jobs || {};
    cache.runs = cache.runs || [];
    cache.nextRunId = cache.nextRunId || 1;
  } catch {
    cache = defaultStore();
  }
  return cache;
}

function save() {
  ensureDataDir();
  fs.writeFileSync(storeFilePath(), JSON.stringify(cache, null, 2), "utf8");
}

export function getMeta(key, fallback = null) {
  const s = load();
  return Object.prototype.hasOwnProperty.call(s.meta, key)
    ? s.meta[key]
    : fallback;
}

export function setMeta(key, value) {
  const s = load();
  s.meta[key] = String(value);
  save();
}

export function beginRun() {
  const s = load();
  const id = s.nextRunId++;
  s.runs.push({
    id,
    started_at: new Date().toISOString(),
    finished_at: null,
    new_count: 0,
    updated_count: 0,
    skipped_count: 0,
    error: null,
  });
  save();
  return id;
}

export function finishRun(runId, counts, error = null) {
  const s = load();
  const run = s.runs.find((r) => r.id === runId);
  if (!run) return;
  run.finished_at = new Date().toISOString();
  run.new_count = counts.newCount || 0;
  run.updated_count = counts.updatedCount || 0;
  run.skipped_count = counts.skippedCount || 0;
  run.error = error;
  save();
}

export function getLastRun() {
  const s = load();
  if (!s.runs.length) return null;
  return s.runs[s.runs.length - 1];
}

export function getStatus() {
  const s = load();
  const jobs = Object.values(s.jobs);
  const lastRun = getLastRun();
  const bySource = {};
  for (const id of SOURCE_IDS) {
    bySource[`${id}Jobs`] = jobs.filter(
      (j) => String(j.source || "").toLowerCase() === id
    ).length;
  }
  return {
    totalJobs: jobs.length,
    ...bySource,
    usJobs: jobs.filter((j) => classifyRegion(j) === "US").length,
    auJobs: jobs.filter((j) => classifyRegion(j) === "AU").length,
    diceJobs: bySource.diceJobs,
    jobrightJobs: bySource.jobrightJobs,
    newJobs: jobs.filter((j) => j.status === "new").length,
    lastRun: lastRun || null,
    csvUsPath: config.csvUsPath,
    csvAuPath: config.csvAuPath,
    lastCsvUs: getMeta("last_csv_us_path"),
    lastCsvAu: getMeta("last_csv_au_path"),
    apiBase: config.apiBase,
  };
}

function jobFromRow(row) {
  if (!row) return null;
  const out = {};
  for (const h of CSV_HEADERS) out[h] = row[h] ?? "";
  return out;
}

export function getJob(id) {
  return jobFromRow(load().jobs[String(id)]);
}

export function listJobs({ status, source, region, limit = 50 } = {}) {
  const lim = Math.max(1, Math.min(500, Number(limit) || 50));
  let rows = Object.values(load().jobs);
  if (status) rows = rows.filter((j) => j.status === String(status));
  if (source) {
    const src = String(source).toLowerCase();
    rows = rows.filter((j) => String(j.source || "").toLowerCase() === src);
  }
  if (region) {
    const r = String(region).toUpperCase();
    rows = rows.filter((j) => classifyRegion(j) === r);
  }
  rows.sort((a, b) =>
    String(b.last_seen_at || "").localeCompare(String(a.last_seen_at || ""))
  );
  return rows.slice(0, lim).map(jobFromRow);
}

export function allJobs() {
  return Object.values(load().jobs)
    .sort((a, b) =>
      String(a.first_seen_at || "").localeCompare(String(b.first_seen_at || ""))
    )
    .map(jobFromRow);
}

/**
 * @returns {{ status: 'new'|'updated', job: object }}
 */
export function upsertJob(scraped, runId) {
  const s = load();
  const now = new Date().toISOString();
  const id = String(scraped.id);
  const existing = s.jobs[id];
  const stamped = applyRegionFields({ ...scraped });

  const base = {
    id,
    title: stamped.title || "",
    organization: stamped.organization || "",
    location: stamped.location || "",
    work_arrangement: stamped.work_arrangement || "",
    remote_restricted_to: stamped.remote_restricted_to || "",
    region: stamped.region || "",
    experience_level: stamped.experience_level || "",
    employment_type: stamped.employment_type || "",
    salary_min: stamped.salary_min ?? "",
    salary_max: stamped.salary_max ?? "",
    salary_currency: stamped.salary_currency || "USD",
    salary_unit: stamped.salary_unit || "",
    key_skills: stamped.key_skills || "",
    source: stamped.source || "dice",
    date_posted: stamped.date_posted || "",
    url: stamped.url || "",
    description: stamped.description || "",
  };

  if (!existing) {
    const job = {
      ...base,
      first_seen_run_id: runId,
      last_seen_run_id: runId,
      first_seen_at: now,
      last_seen_at: now,
      status: "new",
    };
    s.jobs[id] = job;
    save();
    return { status: "new", job };
  }

  const job = {
    ...base,
    first_seen_run_id: existing.first_seen_run_id,
    last_seen_run_id: runId,
    first_seen_at: existing.first_seen_at,
    last_seen_at: now,
    status: "updated",
  };
  s.jobs[id] = job;
  save();
  return { status: "updated", job };
}

export function jobsBySource(source) {
  const src = String(source || "").toLowerCase();
  return allJobs().filter((j) => String(j.source || "").toLowerCase() === src);
}

export function pruneStore() {
  const s = load();
  const ids = Object.keys(s.jobs);
  let removed = 0;
  for (const id of ids) {
    if (!matchesOutputRule(s.jobs[id])) {
      delete s.jobs[id];
      removed += 1;
    }
  }
  if (removed > 0) save();
  return { removed, kept: Object.keys(s.jobs).length };
}

export function removeJobs(ids) {
  const s = load();
  let removed = 0;
  for (const id of ids || []) {
    const key = String(id);
    if (Object.prototype.hasOwnProperty.call(s.jobs, key)) {
      delete s.jobs[key];
      removed += 1;
    }
  }
  if (removed > 0) save();
  return { removed, kept: Object.keys(s.jobs).length };
}

function csvSourceRank(source) {
  const src = String(source || "").toLowerCase();
  const idx = CSV_SOURCE_ORDER.indexOf(src);
  return idx === -1 ? CSV_SOURCE_ORDER.length : idx;
}

function sortJobs(rows) {
  rows.sort((a, b) => {
    const bySource = csvSourceRank(a.source) - csvSourceRank(b.source);
    if (bySource !== 0) return bySource;
    return String(b.last_seen_at || b.date_posted || "").localeCompare(
      String(a.last_seen_at || a.date_posted || "")
    );
  });
  return rows;
}

/**
 * Write dual US/AU CSVs.
 */
export function syncCsv(rows = null) {
  const all = rows || allJobs();
  const clean = (all || [])
    .filter((j) => matchesOutputRule(j))
    .map((j) => {
      const region = classifyRegion(j);
      return { ...j, region: region || j.region || "" };
    });

  const usRows = sortJobs(clean.filter((j) => j.region === "US"));
  const auRows = sortJobs(clean.filter((j) => j.region === "AU"));

  writeCsv(config.csvUsPath, usRows);
  writeCsv(config.csvAuPath, auRows);

  setMeta("last_csv_us_path", config.csvUsPath);
  setMeta("last_csv_au_path", config.csvAuPath);
  setMeta("last_csv_path", config.csvUsPath);

  return {
    usPath: config.csvUsPath,
    auPath: config.csvAuPath,
    usCount: usRows.length,
    auCount: auRows.length,
    count: usRows.length + auRows.length,
    csvPath: config.csvUsPath,
    latestPath: config.csvUsPath,
  };
}

export function closeStore() {
  if (cache) save();
  cache = null;
}
