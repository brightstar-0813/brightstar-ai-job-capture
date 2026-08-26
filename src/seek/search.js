/**
 * Seek.com.au — Playwright search for remote AU roles (no public API).
 */

import { config } from "../config.js";
import {
  matchesTargetRole,
  isRemoteArrangement,
  isWithinRecentDays,
  parsePostedDate,
} from "../filter.js";
import { applyRegionFields } from "../geo.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSeekUrl(query, page = 1) {
  const params = new URLSearchParams();
  params.set("keywords", query);
  params.set("where", "All Australia");
  params.set("worktype", "4"); // work from home / remote-ish filter when available
  params.set("daterange", String(config.recentDays || 3));
  if (page > 1) params.set("page", String(page));
  return `https://www.seek.com.au/jobs?${params.toString()}`;
}

async function scrapeListing(page) {
  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const articles = document.querySelectorAll(
      'article[data-testid="job-card"], article[data-job-id], [data-automation="normalJob"]'
    );
    for (const art of articles) {
      const id =
        art.getAttribute("data-job-id") ||
        art.getAttribute("data-jobid") ||
        "";
      const link =
        art.querySelector('a[data-automation="jobTitle"]') ||
        art.querySelector('a[href*="/job/"]');
      if (!link) continue;
      const href = (link.href || "").split("?")[0];
      const jobId =
        id ||
        (href.match(/\/job\/(\d+)/) || [])[1] ||
        "";
      if (!jobId || seen.has(jobId)) continue;
      seen.add(jobId);
      const title = (link.textContent || "").replace(/\s+/g, " ").trim();
      const companyEl =
        art.querySelector('[data-automation="jobCompany"]') ||
        art.querySelector('[data-automation="jobCardCompanyLink"]');
      const locEl =
        art.querySelector('[data-automation="jobCardLocation"]') ||
        art.querySelector('[data-automation="jobLocation"]');
      const listedEl = art.querySelector('[data-automation="jobListingDate"]');
      out.push({
        id: jobId,
        url: href.startsWith("http") ? href : `https://www.seek.com.au${href}`,
        title,
        organization: companyEl
          ? (companyEl.textContent || "").replace(/\s+/g, " ").trim()
          : "",
        location: locEl
          ? (locEl.textContent || "").replace(/\s+/g, " ").trim()
          : "Australia",
        date_posted_raw: listedEl
          ? (listedEl.textContent || "").replace(/\s+/g, " ").trim()
          : "",
      });
    }
    return out;
  });
}

async function scrapeDetail(page, stub) {
  await page.goto(stub.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(800 + config.delayMs);

  const data = await page.evaluate(() => {
    const text = (el) =>
      el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
    const h1 = document.querySelector("h1");
    const desc =
      document.querySelector('[data-automation="jobAdDetails"]') ||
      document.querySelector('[data-automation="jobDescription"]') ||
      document.querySelector("div[class*='JobDetails']") ||
      document.querySelector("main");
    const body = desc ? desc.innerText || "" : "";
    const work =
      /\bremote\b|\bwork from home\b|\bwfh\b/i.test(body.slice(0, 4000)) ||
      /\bremote\b/i.test(document.body.innerText.slice(0, 2000))
        ? "Remote"
        : "Onsite";
    return {
      title: text(h1),
      description: body.replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000),
      work_arrangement: work,
    };
  });

  const postedAbs = parsePostedDate(stub.date_posted_raw);
  const datePosted = postedAbs
    ? postedAbs.toISOString().slice(0, 10)
    : String(stub.date_posted_raw || "");

  const job = {
    id: `seek_${stub.id}`,
    title: data.title || stub.title || "",
    organization: stub.organization || "",
    location: stub.location || "Australia",
    work_arrangement: data.work_arrangement || "Remote",
    remote_restricted_to: "Australia",
    region: "AU",
    experience_level: "",
    employment_type: "",
    salary_min: "",
    salary_max: "",
    salary_currency: "AUD",
    salary_unit: "",
    key_skills: "",
    source: "seek",
    date_posted: datePosted,
    url: stub.url,
    description: data.description || "",
  };
  return job;
}

/**
 * @param {import('playwright').Browser} browser
 */
export async function searchSeekJobs(browser) {
  const queries = config.searchQueries?.length
    ? config.searchQueries
    : [config.searchQ];
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "en-AU",
  });
  const page = await context.newPage();
  const byId = new Map();
  let listingCount = 0;

  try {
    for (const query of queries) {
      for (let p = 1; p <= Math.min(config.maxPages, 3); p += 1) {
        const url = buildSeekUrl(query, p);
        console.log(`[seek] ${query} page ${p}`);
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
          await sleep(1200 + config.delayMs);
          const stubs = await scrapeListing(page);
          listingCount += stubs.length;
          if (!stubs.length) break;
          for (const stub of stubs) {
            if (byId.has(stub.id)) continue;
            byId.set(stub.id, stub);
          }
        } catch (err) {
          console.warn(`[seek] listing failed: ${err.message}`);
          break;
        }
      }
    }

    const jobs = [];
    const stubs = [...byId.values()].slice(0, 40);
    for (const stub of stubs) {
      try {
        const job = await scrapeDetail(page, stub);
        if (!isRemoteArrangement(job.work_arrangement)) continue;
        if (!matchesTargetRole(job)) continue;
        if (isWithinRecentDays(job.date_posted, config.recentDays) === false) {
          continue;
        }
        applyRegionFields(job);
        jobs.push(job);
      } catch (err) {
        console.warn(`[seek] detail ${stub.id}: ${err.message}`);
      }
    }

    console.log(
      `[seek] kept ${jobs.length} (listings=${listingCount}, details=${stubs.length})`
    );
    return { jobs };
  } finally {
    await context.close().catch(() => {});
  }
}
