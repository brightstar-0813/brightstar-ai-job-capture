/**
 * We Work Remotely — official category RSS feeds (no auth).
 * https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss
 */

import {
  plainText,
  toIsoDate,
  keepNormalizedJob,
  emptyJobFields,
} from "../sources/normalize.js";

const FEEDS = [
  "remote-back-end-programming-jobs",
  "remote-full-stack-programming-jobs",
  "remote-devops-sysadmin-jobs",
];

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function readTag(block, name) {
  const m = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i")
  );
  return m ? decodeXml(m[1].trim()) : "";
}

function splitTitle(rawTitle) {
  const title = String(rawTitle || "").trim();
  const idx = title.indexOf(":");
  if (idx <= 0) return { organization: "", title };
  return {
    organization: title.slice(0, idx).trim(),
    title: title.slice(idx + 1).trim(),
  };
}

function jobIdFromGuid(guid) {
  const slug = String(guid || "")
    .replace(/^https?:\/\/weworkremotely\.com\/remote-jobs\//i, "")
    .replace(/\/$/, "");
  return slug ? `wwr_${slug}` : "";
}

function mapItem(block) {
  const guid = readTag(block, "guid") || readTag(block, "link");
  const id = jobIdFromGuid(guid);
  if (!id) return null;

  const { organization, title } = splitTitle(readTag(block, "title"));
  const region = readTag(block, "region");
  const country = readTag(block, "country");
  const state = readTag(block, "state");
  const skills = readTag(block, "skills");
  const location = [region, country, state].filter(Boolean).join(" | ");
  const url = guid.startsWith("http") ? guid : "";

  return emptyJobFields({
    id,
    title,
    organization,
    location,
    work_arrangement: "Remote",
    remote_restricted_to: location,
    country,
    key_skills: skills,
    source: "weworkremotely",
    date_posted: toIsoDate(readTag(block, "pubDate")),
    url,
    description: plainText(readTag(block, "description")),
    employment_type: readTag(block, "type"),
  });
}

async function fetchRss(slug) {
  const url = `https://weworkremotely.com/categories/${slug}.rss`;
  const res = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml, */*",
      "user-agent":
        "ai-ml-be-job-capture/1.0 (personal job hunt; +https://github.com/local)",
    },
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = re.exec(xml))) {
    items.push(match[1]);
  }
  return items;
}

/**
 * @param {import('playwright').Browser} [_browser]
 */
export async function searchWeworkremotelyJobs(_browser) {
  const seen = new Set();
  const jobs = [];
  let fetched = 0;

  console.log(`[weworkremotely] fetching ${FEEDS.length} RSS feeds`);

  for (const slug of FEEDS) {
    try {
      const xml = await fetchRss(slug);
      const blocks = parseItems(xml);
      fetched += blocks.length;
      for (const block of blocks) {
        const mapped = mapItem(block);
        if (!mapped?.id || seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        const kept = keepNormalizedJob(mapped);
        if (kept) jobs.push(kept);
      }
    } catch (err) {
      console.warn(`[weworkremotely] feed "${slug}" failed: ${err.message}`);
    }
  }

  console.log(`[weworkremotely] kept ${jobs.length} (fetched=${fetched})`);
  return { jobs };
}
