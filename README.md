# US/AU remote SWE + AI/ML job capture

Capture **remote** Software Engineer, **AI-focused Backend**, and **AI/ML Engineer** roles from public APIs, ATS boards, and scrapers. Export **separate US and AU CSVs** twice daily (5:00 AM and 5:00 PM local).

## What gets saved

Each run overwrites dual CSVs:

- `download/jobs_us_latest.csv` — US-eligible remote roles
- `download/jobs_au_latest.csv` — AU-eligible remote roles
- `download/store.json` — shared dedupe history

Filter (all sources):

- **Keep (remote only):**
  - **Software Engineer** title family (Senior/Staff/Principal OK)
  - **Backend / Back-end Engineer** with AI signal in title **or** JD
  - **AI/ML Engineer** family in title (AI, ML, LLM, GenAI, Agentic, …)
  - Engineer/Developer title + **strong JD AI/ML keywords** (LLM, PyTorch, LangChain, RAG, …)
- **Skip:** Data Engineer / Salesforce / **Frontend / UI / UX** (React, Angular, Vue, client-side); non-eng titles (sales, recruiting, PM, designer, intern, …); hybrid/on-site; LinkedIn apply links; expired; older than `RECENT_DAYS` (default 3); worldwide remotes that cannot be classified as US or AU

## Sources (public APIs preferred)

| Source | Type | Notes |
|--------|------|-------|
| **Remotive** | Public JSON | Attribution: Remotive.com |
| **Jobicy** | Public JSON | `geo=usa` / `apac` / `anywhere` |
| **Himalayas** | Public JSON | Country search US + Australia |
| **Arbeitnow** | Public JSON | Aggregated ATS feed |
| **RemoteOK** | Public JSON | Client-side query filter |
| **We Work Remotely** | Official RSS | Back-end, full-stack, DevOps categories (no front-end feed) |
| **Greenhouse** | Public board API | Curated company boards |
| **Lever** | Public postings API | Curated company list |
| **Ashby** | Public job-board API | Curated org list |
| **Dice** | Playwright | US; optional login for applied exclusion |
| **JobRight** | Extension / Playwright | US |
| **Built In** | Playwright | US-centric |
| **Seek** | Playwright | AU (`seek.com.au`) |
| **ZipRecruiter / Monster** | Playwright | Often blocked in headless |

### Applyre “Top 200” list — what we use vs skip

From [Applyre’s job-site roundup](https://applyre.com/blog/top-200-job-sites-in-the-us), most entries are **general aggregators, niche verticals, or login-heavy boards** that do not fit this bot’s model (public API / ATS / targeted remote tech feeds, US+AU, SWE/Backend+AI/ML only).

| Category | Covered today | Not added (why) |
|----------|---------------|-----------------|
| General (Indeed, LinkedIn, Glassdoor, CareerBuilder, SimplyHired, Snagajob, USAJOBS) | ZipRecruiter, Monster (often blocked); Dice, JobRight | No stable public API; heavy anti-bot / ToS |
| Remote (FlexJobs, Remote.co, **We Work Remotely**, Working Nomads, Pangian, …) | Remotive, Jobicy, Himalayas, RemoteOK, **We Work Remotely RSS** | FlexJobs paid; Working Nomads API auth-only; others duplicate or need scraping |
| Tech / startups (Dice, Built In, AngelList, Stack Overflow Jobs, …) | Dice, Built In, Greenhouse/Lever/Ashby | AngelList/Wellfound changed; SO Jobs shut down |
| Freelance / creative / healthcare / education / military / D&I / niche | — | Out of scope (not full-time remote SWE/AI roles) |
| Meta search (Google for Jobs, CareerJet, Jooble, Adzuna, Talent.com) | Partial overlap via Arbeitnow | Aggregators; low signal vs dedicated remote APIs |

Good next candidates if you want more volume: **Remote.co** (scrape), **Hubstaff Talent** (free board), **Wellfound** (startup API if still public).

## Manual run

```bash
npm run capture
```

## Local API + extension

```bash
npm start
```

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Last run, CSV paths, source toggles |
| `GET /api/jobs?region=US` | List stored jobs |
| `POST /api/run` | Trigger capture |
| `POST /api/ingest` | Extension posts JobRight jobs |
| `GET /api/export.csv?region=us` | Download US CSV |
| `GET /api/export.csv?region=au` | Download AU CSV |

## Env highlights

See [`.env.example`](.env.example) for `SEARCH_QUERIES`, `CAPTURE_*`, `CSV_US_FILE` / `CSV_AU_FILE`, and board/company lists.

## Scheduler (Windows)

```bash
npm run schedule:install
```

Runs capture at **5:00 AM** and **5:00 PM**, and starts the local API at logon for the JobRight extension.

## Notes

- Personal job-hunting use; polite delays / page caps.
- Remotive data is used for personal discovery; attribute Remotive.com when sharing derived listings.
- Re-run `npm run jobright:login` / `npm run dice:login` when sessions expire.
