# Sentinel — Project Context

## What this is
Distributed orchestration engine for automated web data extraction, conditional
monitoring, and alerting. Instead of brittle CSS-selector scraping, it pipes raw
page text through an LLM (Groq / Llama-3) constrained to strict JSON schemas —
a "fuzzy parser" that survives website redesigns.

Full architecture, design rationale, and file map: see `docs/HANDOFF.md`.
Read it before any non-trivial change.

## Architecture (one-paragraph mental model)
Express API saves a `Job` (status `pending`) to MongoDB and pushes the ID to the
Redis Stream `sentinel:tasks`. `worker.js` is the master router: it runs a
blocking `xreadgroup` loop (consumer group `sentinel_workers`), sets Mongo status
`processing`, dispatches via a `switch` to a sub-worker in `workers/`, then on
completion spawns the *next* job itself (Auto-Handoff: Scraper → AI → Email).
Sub-workers never call each other. MongoDB is the source of truth for state;
Redis is ephemeral transport + cooldown/telemetry tracking.

## Hard rules — do not "fix" these, they are intentional
- `scraperWorker.js`: swallowing the `NaN` extraction error and returning raw
  text WHEN `job.payload.aiInstructions` exists is the deliberate "Observer Mode"
  feature. Not a missing validation.
- `worker.js`: hoisting `payload.guard.emailTo` → `payload.emailTo` on downstream
  job creation is intentional remapping.
- `worker.js`: silently dropping `modelUsed`, `timestamp`, `provider` from email
  bodies is intentional.
- `summaryWorker.js`: the `try/catch` around `JSON.parse` with
  `{ summary: rawContent }` fallback handles LLM hallucination. Never remove it.

## Known broken / incomplete (priority order)
1. **Cron execution is dead.** `worker.js` parses cron and writes
   `job.scheduledAt` to Mongo, but nothing pushes due jobs back into Redis.
   Needs a separate `cronPoller.js` daemon: poll Mongo for
   `scheduledAt <= now && status === 'pending'`, push IDs to `sentinel:tasks`.
2. **Redis PEL leak — at-least-once is NOT guaranteed.** If `worker.js` dies
   after `xreadgroup` but before `xack`, the message is orphaned in the Pending
   Entries List forever. No `XPENDING`/`XAUTOCLAIM` sweeper exists. Needs one.
3. **State desync.** Redis drop mid-processing leaves Mongo stuck on
   `processing` indefinitely. Related to (2).
4. **Puppeteer memory leak.** `scraperWorker.js` opens a new page per task with
   no browser pool. Fails under concurrency.
5. **Email is sandbox-locked.** Resend hardcoded to `onboarding@resend.dev`,
   delivers only to the dev's registered address. Lifting it needs a custom
   domain bound to Resend.

## Stack
Node.js (assume 18+), MongoDB via `mongoose`, Redis via `ioredis`, React
frontend, `groq-sdk` (`llama-3.3-70b-versatile`), `puppeteer` (+`user-agents`),
`resend`, `cron-parser`. Exact versions: read `package.json` — do not assume.

## Working conventions
- Confirm versions and unknowns from the actual code, never from this file or
  memory. `apiWorker.js` and `guardWorker.js` behavior is unverified — read them
  before touching.
- Full updated files, not partial diffs.
- State which file/function before proposing a change.
