/**
 * Local API + optional node-cron at 5:00 AM and 5:00 PM daily.
 */

import express from "express";
import cron from "node-cron";
import fs from "fs";
import { config } from "./config.js";
import { runCapture, isCaptureRunning } from "./capture.js";
import { ingestJobsPayload } from "./ingest.js";
import {
  getStatus,
  listJobs,
  syncCsv,
  closeStore,
  getMeta,
} from "./store.js";

const app = express();
app.use(express.json({ limit: "8mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ai-ml-be-job-capture-us-au" });
});

app.get("/api/status", (_req, res) => {
  try {
    res.json({
      ...getStatus(),
      capturing: isCaptureRunning(),
      searchQ: config.searchQ,
      cronSchedule: config.cronSchedule,
      lastCsvUs: getMeta("last_csv_us_path"),
      lastCsvAu: getMeta("last_csv_au_path"),
      captureDice: config.captureDice,
      captureJobright: config.captureJobright,
      captureBuiltin: config.captureBuiltin,
      captureGreenhouse: config.captureGreenhouse,
      captureZiprecruiter: config.captureZiprecruiter,
      captureMonster: config.captureMonster,
      captureRemotive: config.captureRemotive,
      captureJobicy: config.captureJobicy,
      captureHimalayas: config.captureHimalayas,
      captureArbeitnow: config.captureArbeitnow,
      captureRemoteok: config.captureRemoteok,
      captureLever: config.captureLever,
      captureAshby: config.captureAshby,
      captureSeek: config.captureSeek,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/jobs", (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const source = req.query.source ? String(req.query.source) : undefined;
    const region = req.query.region ? String(req.query.region) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json({ ok: true, jobs: listJobs({ status, source, region, limit }) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/run", async (_req, res) => {
  if (isCaptureRunning()) {
    res.status(409).json({ ok: false, error: "Capture already in progress" });
    return;
  }
  res.json({ ok: true, started: true });
  runCapture().catch((err) => console.error("[api/run]", err));
});

app.post("/api/ingest", async (req, res) => {
  try {
    const jobs = req.body?.jobs;
    if (!Array.isArray(jobs)) {
      res.status(400).json({ ok: false, error: "Body must include jobs: []" });
      return;
    }
    const source = String(req.body?.source || "jobright").toLowerCase();
    const result = await ingestJobsPayload(jobs, {
      source,
      trusted: !!req.body?.trusted,
      skipSlack: !!req.body?.skipSlack,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/export.csv", (req, res) => {
  try {
    const result = syncCsv();
    const region = String(req.query.region || "us").toLowerCase();
    const file =
      region === "au"
        ? result.auPath || getMeta("last_csv_au_path")
        : result.usPath || getMeta("last_csv_us_path");
    const filename =
      region === "au" ? "jobs_au_latest.csv" : "jobs_us_latest.csv";
    if (!file || !fs.existsSync(file)) {
      res.status(404).send("No CSV yet. Run a capture first.");
      return;
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(`[server] http://127.0.0.1:${config.port}`);
  console.log(
    `[server] cron "${config.cronSchedule}" (5 AM and 5 PM daily by default)`
  );
});

if (cron.validate(config.cronSchedule)) {
  cron.schedule(config.cronSchedule, () => {
    console.log("[cron] scheduled capture starting");
    runCapture().catch((err) => console.error("[cron]", err));
  });
} else {
  console.warn(`[server] invalid CRON_SCHEDULE: ${config.cronSchedule}`);
}

function shutdown() {
  console.log("[server] shutting down");
  server.close(() => {
    closeStore();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
