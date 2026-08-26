/**
 * Capture remote SWE / AI-focused Backend / AI-ML jobs from public APIs,
 * ATS boards, and Playwright scrapers. Dual US/AU CSV export.
 */

import { chromium } from "playwright";
import { config } from "./config.js";
import { searchDiceJobs } from "./dice/search.js";
import { scrapeJobDetails } from "./dice/detail.js";
import { searchJobrightJobs } from "./jobright/search.js";
import { searchBuiltinJobs } from "./builtin/search.js";
import { searchGreenhouseJobs } from "./greenhouse/search.js";
import { searchZiprecruiterJobs } from "./ziprecruiter/search.js";
import { searchMonsterJobs } from "./monster/search.js";
import { searchRemotiveJobs } from "./remotive/search.js";
import { searchJobicyJobs } from "./jobicy/search.js";
import { searchHimalayasJobs } from "./himalayas/search.js";
import { searchArbeitnowJobs } from "./arbeitnow/search.js";
import { searchRemoteokJobs } from "./remoteok/search.js";
import { searchWeworkremotelyJobs } from "./weworkremotely/search.js";
import { searchLeverJobs } from "./lever/search.js";
import { searchAshbyJobs } from "./ashby/search.js";
import { searchSeekJobs } from "./seek/search.js";
import { matchesCaptureRule } from "./filter.js";
import { applyRegionFields, classifyRegion } from "./geo.js";
import {
  beginRun,
  finishRun,
  upsertJob,
  syncCsv,
  closeStore,
  getMeta,
  pruneStore,
  removeJobs,
} from "./store.js";
import {
  notifyCaptureComplete,
  notifyJobrightLoginExpired,
  notifyDiceLoginExpired,
} from "./slack.js";

let running = false;

function ingestJobs(jobs, runId, counts, newJobs) {
  for (const job of jobs) {
    if (!job?.id) {
      counts.skippedCount += 1;
      continue;
    }
    applyRegionFields(job);
    if (!matchesCaptureRule(job)) {
      counts.skippedCount += 1;
      console.log(
        `[filter] skip ${job.id}: not remote SWE/Backend+AI/AI-ML match`
      );
      continue;
    }
    const region = classifyRegion(job);
    if (region !== "US" && region !== "AU") {
      counts.skippedCount += 1;
      console.log(`[filter] skip ${job.id}: ambiguous region (not US/AU)`);
      continue;
    }
    job.region = region;
    const { status, job: saved } = upsertJob(job, runId);
    if (status === "new") {
      counts.newCount += 1;
      newJobs.push(saved);
    } else {
      counts.updatedCount += 1;
    }
  }
}

function enabledSources() {
  const out = [];
  if (config.captureRemotive) out.push("remotive");
  if (config.captureJobicy) out.push("jobicy");
  if (config.captureHimalayas) out.push("himalayas");
  if (config.captureArbeitnow) out.push("arbeitnow");
  if (config.captureRemoteok) out.push("remoteok");
  if (config.captureWeworkremotely) out.push("weworkremotely");
  if (config.captureGreenhouse) out.push("greenhouse");
  if (config.captureLever) out.push("lever");
  if (config.captureAshby) out.push("ashby");
  if (config.captureDice) out.push("dice");
  if (config.captureBuiltin) out.push("builtin");
  if (config.captureZiprecruiter) out.push("ziprecruiter");
  if (config.captureMonster) out.push("monster");
  if (config.captureSeek) out.push("seek");
  if (config.captureJobright) out.push("jobright");
  return out;
}

async function runApiSource(name, fn, runId, counts, newJobs) {
  try {
    const { jobs } = await fn(null);
    console.log(`[capture] ${name} jobs: ${jobs.length}`);
    ingestJobs(jobs, runId, counts, newJobs);
  } catch (err) {
    console.warn(`[capture] ${name} failed, continuing: ${err.message}`);
  }
}

export async function runCapture({ skipSlack = false } = {}) {
  if (running) {
    return { ok: false, error: "Capture already in progress" };
  }
  running = true;
  const runId = beginRun();
  const counts = { newCount: 0, updatedCount: 0, skippedCount: 0 };
  const newJobs = [];
  let jobrightAuthExpired = false;
  let diceAuthExpired = false;
  const enabled = enabledSources();

  console.log(
    `[capture] run #${runId} starting (queries=${(config.searchQueries || [config.searchQ]).join(" | ")}) sources=${enabled.join(",")}`
  );

  let browser;
  const swallowTransient = (err) => {
    console.warn(`[capture] transient browser error: ${err?.message || err}`);
  };
  process.on("uncaughtException", swallowTransient);
  process.on("unhandledRejection", swallowTransient);

  try {
    // Public JSON APIs first (no browser)
    if (config.captureRemotive) {
      await runApiSource("remotive", searchRemotiveJobs, runId, counts, newJobs);
    }
    if (config.captureJobicy) {
      await runApiSource("jobicy", searchJobicyJobs, runId, counts, newJobs);
    }
    if (config.captureHimalayas) {
      await runApiSource(
        "himalayas",
        searchHimalayasJobs,
        runId,
        counts,
        newJobs
      );
    }
    if (config.captureArbeitnow) {
      await runApiSource(
        "arbeitnow",
        searchArbeitnowJobs,
        runId,
        counts,
        newJobs
      );
    }
    if (config.captureRemoteok) {
      await runApiSource("remoteok", searchRemoteokJobs, runId, counts, newJobs);
    }
    if (config.captureWeworkremotely) {
      await runApiSource(
        "weworkremotely",
        searchWeworkremotelyJobs,
        runId,
        counts,
        newJobs
      );
    }
    if (config.captureGreenhouse) {
      await runApiSource(
        "greenhouse",
        searchGreenhouseJobs,
        runId,
        counts,
        newJobs
      );
    }
    if (config.captureLever) {
      await runApiSource("lever", searchLeverJobs, runId, counts, newJobs);
    }
    if (config.captureAshby) {
      await runApiSource("ashby", searchAshbyJobs, runId, counts, newJobs);
    }

    const needsBrowser =
      config.captureDice ||
      config.captureBuiltin ||
      config.captureZiprecruiter ||
      config.captureMonster ||
      config.captureSeek ||
      config.captureJobright;

    if (needsBrowser) {
      browser = await chromium.launch({ headless: config.headless });
    }

    if (config.captureDice) {
      try {
        const { jobs: stubs, appliedIds: diceApplied, unauthenticated } =
          await searchDiceJobs(browser);
        diceAuthExpired = !!unauthenticated;
        console.log(`[capture] dice listings: ${stubs.length}`);
        const details = await scrapeJobDetails(browser, stubs);
        console.log(`[capture] dice details: ${details.length}`);
        ingestJobs(details, runId, counts, newJobs);

        if (Array.isArray(diceApplied) && diceApplied.length) {
          const { removed } = removeJobs(diceApplied);
          if (removed > 0) {
            console.log(
              `[capture] removed ${removed} already-applied dice jobs from store`
            );
          }
        }
      } catch (err) {
        console.warn(`[capture] dice failed, continuing: ${err.message}`);
        try {
          await browser.close();
        } catch {
          /* ignore */
        }
        browser = await chromium.launch({ headless: config.headless });
      }
    }

    if (config.captureBuiltin) {
      try {
        const { jobs } = await searchBuiltinJobs(browser);
        console.log(`[capture] builtin jobs: ${jobs.length}`);
        ingestJobs(jobs, runId, counts, newJobs);
      } catch (err) {
        console.warn(`[capture] builtin failed: ${err.message}`);
      }
    }

    if (config.captureZiprecruiter) {
      try {
        const { jobs, blocked } = await searchZiprecruiterJobs(browser);
        console.log(
          `[capture] ziprecruiter jobs: ${jobs.length}${blocked ? " (blocked)" : ""}`
        );
        ingestJobs(jobs, runId, counts, newJobs);
      } catch (err) {
        console.warn(`[capture] ziprecruiter failed: ${err.message}`);
      }
    }

    if (config.captureMonster) {
      try {
        const { jobs, blocked } = await searchMonsterJobs(browser);
        console.log(
          `[capture] monster jobs: ${jobs.length}${blocked ? " (blocked)" : ""}`
        );
        ingestJobs(jobs, runId, counts, newJobs);
      } catch (err) {
        console.warn(`[capture] monster failed: ${err.message}`);
      }
    }

    if (config.captureSeek) {
      try {
        const { jobs } = await searchSeekJobs(browser);
        console.log(`[capture] seek jobs: ${jobs.length}`);
        ingestJobs(jobs, runId, counts, newJobs);
      } catch (err) {
        console.warn(`[capture] seek failed: ${err.message}`);
      }
    }

    if (config.captureJobright) {
      try {
        const { jobs: jrJobs, auth, appliedIds } =
          await searchJobrightJobs(browser);
        console.log(`[capture] jobright jobs: ${jrJobs.length}`);
        jobrightAuthExpired = !!auth?.unauthenticated;
        ingestJobs(jrJobs, runId, counts, newJobs);

        if (Array.isArray(appliedIds) && appliedIds.length) {
          const { removed } = removeJobs(appliedIds);
          if (removed > 0) {
            console.log(
              `[capture] removed ${removed} already-applied jobright jobs from store`
            );
          }
        }
      } catch (err) {
        console.warn(`[capture] jobright failed: ${err.message}`);
      }
    }

    const pruned = pruneStore();
    if (pruned.removed > 0) {
      console.log(
        `[capture] pruned ${pruned.removed} legacy jobs no longer matching rule`
      );
    }
    const csvOut = syncCsv();
    console.log(
      `[capture] done — new=${counts.newCount} updated=${counts.updatedCount} skipped=${counts.skippedCount}`
    );
    console.log(
      `[capture] us=${csvOut.usPath} (rows=${csvOut.usCount}) au=${csvOut.auPath} (rows=${csvOut.auCount})`
    );

    if (!skipSlack) {
      try {
        await notifyCaptureComplete({
          webhookUrl: config.slackWebhookUrl,
          runId,
          source: enabled.join("+"),
          ...counts,
          newJobs,
          usCount: csvOut.usCount,
          auCount: csvOut.auCount,
        });
        if (jobrightAuthExpired) {
          await notifyJobrightLoginExpired({
            webhookUrl: config.slackWebhookUrl,
            runId,
          });
        }
        if (diceAuthExpired) {
          await notifyDiceLoginExpired({
            webhookUrl: config.slackWebhookUrl,
            runId,
          });
        }
      } catch (slackErr) {
        console.warn(`[slack] ${slackErr.message}`);
      }
    }

    finishRun(runId, counts);
    return {
      ok: true,
      runId,
      ...counts,
      newJobs,
      usPath: csvOut.usPath,
      auPath: csvOut.auPath,
      usCount: csvOut.usCount,
      auCount: csvOut.auCount,
      csvPath: csvOut.csvPath,
      latestPath: csvOut.latestPath,
      csvCount: csvOut.count,
      lastCsvUs: getMeta("last_csv_us_path"),
      lastCsvAu: getMeta("last_csv_au_path"),
    };
  } catch (err) {
    const error = err.message || String(err);
    console.error(`[capture] failed: ${error}`);
    finishRun(runId, counts, error);
    return { ok: false, runId, ...counts, error };
  } finally {
    process.off("uncaughtException", swallowTransient);
    process.off("unhandledRejection", swallowTransient);
    if (browser) await browser.close().catch(() => {});
    running = false;
  }
}

export function isCaptureRunning() {
  return running;
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("capture.js") ||
    process.argv[1].replace(/\\/g, "/").endsWith("/src/capture.js"));

if (isMain) {
  runCapture()
    .then((result) => {
      closeStore();
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      closeStore();
      process.exit(1);
    });
}
