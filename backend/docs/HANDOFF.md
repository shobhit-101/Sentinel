# Sentinel — Technical Handoff

## 1. Problem & purpose

Sentinel is a distributed orchestration engine that automates data extraction,
conditional monitoring, and alerting. It solves the inherent fragility of
traditional DOM-based web scraping by acting as a "fuzzy parser" — extracting raw
unstructured text via headless browsers and piping it through an LLM (Llama-3)
enforced with strict JSON schemas. This allows developers to define dynamic,
self-healing data pipelines and logic gates without constantly updating CSS
selectors.

## 2. Architecture

Asynchronous, event-driven pipeline separated into distinct services:

- **API Server (Express):** Receives requests from the React frontend, saves a
  `Job` to MongoDB with status `pending`, and pushes the Job ID/Type to a Redis
  Stream.
- **Message Broker (Redis Streams):** Stream key `sentinel:tasks`. `worker.js`
  connects via consumer group `sentinel_workers`, consumer name `worker_1`.
- **Orchestrator (`worker.js`):** Master router. Continuous `xreadgroup`
  blocking loop. On a job: sets Mongo status `processing`, runs a `switch` to
  load the correct sub-worker, handles "Auto-Handoff" routing.
- **Auto-Handoff Pipeline:** Sub-workers do *not* call each other. `worker.js`
  evaluates a completed task's output and spawns *new* Jobs into the DB/stream.
  Flow: Scraper → `worker.js` (creates AI Job) → AI Worker → `worker.js`
  (creates Email Job) → Email Worker.
- **Persistence (MongoDB):** Source of truth for job state, payloads, execution
  logs, scheduling. Redis is ephemeral transport + distributed state tracking
  (cooldowns/telemetry).

## 3. Tech stack with exact versions

*Exact `package.json` semver not provided. UNKNOWN — verify in code.*

- **Runtime:** Node.js (assume v18+ for Puppeteer compatibility)
- **Database:** MongoDB via `mongoose`
- **Broker/Cache:** Redis via `ioredis`
- **Frontend:** React (`vite` or `cra` — UNKNOWN)
- **LLM:** `groq-sdk` (model: `llama-3.3-70b-versatile`)
- **Scraping:** `puppeteer` (`--no-sandbox`, `--disable-gpu`) + `user-agents`
- **Email:** `resend`
- **Scheduling:** `cron-parser`

## 4. Fault tolerance design

- **Retries:** In `worker.js`. On sub-worker `catch`, if
  `job.retryCount < job.maxRetries`: increment, compute exponential backoff
  (`Math.pow(2, job.retryCount) * 30 * 1000`), set future `scheduledAt`, save.
- **Broker acks:** `XACK` and `XDEL` called in `worker.js` on success AND on
  final failure (max retries exhausted).
- **Guarantees & gaps:** Targets *at-least-once* but does not currently
  guarantee it. If `worker.js` is OOM-killed after `xreadgroup` but before
  `xack`, the message stays in the Redis PEL. No `XPENDING`/`XAUTOCLAIM` sweeper
  exists — dead-worker jobs are permanently lost.
- **State desync:** Redis drop mid-processing leaves Mongo on `processing`
  indefinitely.

## 5. Key design decisions and reasoning

- **Redis Streams vs BullMQ/RabbitMQ:** Bare Streams to minimize deps and reuse
  the Redis instance needed for cooldowns (`cooldown:${user}:${metric}`).
  Tradeoff: manual consumer-group handling, no built-in DLQ.
- **Prompt-driven parsing vs DOM traversal:** Pass raw `.textContent` to the
  LLM. Reasoning: immunity to redesigns. Tradeoff: higher latency, context-
  window limits on large payloads.
- **Schema-agnostic JSON:** `worker.js` loops `Object.entries(taskResult)` for
  email bodies rather than hardcoding keys. Lets users invent new LLM
  personas/prompts without backend deploys.
- **Discrete handoffs vs monolithic:** Pipeline spawns 3 DB entries instead of
  in-memory variables. Granular observability — if Resend is down, scraping/AI
  costs aren't wasted; only the Email job retries.

## 6. Current state

- **Working:** Puppeteer headless scraping (anti-bot config), Groq JSON-mode
  inference, dynamic `worker.js` routing + auto-handoff, Resend dispatch
  via verified `sentinel.engineer` domain (any user-supplied `emailTo` works),
  React UI dynamic JSON rendering.
- **Partial:** Cron scheduling — `worker.js` parses cron and updates
  `job.scheduledAt`, but nothing pushes it back to Redis.
- **Broken:** Cron loop execution; PEL memory leak.

## 7. Known issues, bugs, TODOs

- **TODO — Frontend overhaul (Phase 6):** Split layout — "Static Tasks"
  (sidebar) vs "Active Monitors" (grid).
- **BUG — Cron spawner missing:** Need `cronPoller.js` daemon querying Mongo for
  `scheduledAt <= new Date()` and `status: 'pending'`, pushing IDs to
  `sentinel:tasks`.
- **BUG — Puppeteer memory leak:** `scraperWorker.js` opens `browser.newPage()`
  per task, no pool. Fails at high concurrency.
- **TODO — Redis PEL reclamation:** `xautoclaim` script on an interval to
  recover orphaned messages.

## 8. Gotchas and non-obvious behavior

- **Scraper validation bypass:** `scraperWorker.js` swallows the `NaN` error and
  returns raw text if `job.payload.aiInstructions` exists. Deliberate "Observer
  Mode", not missing validation.
- **Email field remapping:** Frontend nests target in `payload.guard.emailTo`
  on Scraper creation; `worker.js` hoists to `payload.emailTo` for downstream
  jobs.
- **System keys omission:** `worker.js` writes all LLM JSON keys to email body
  but silently drops `modelUsed`, `timestamp`, `provider`.
- **JSON parse fallback:** `summaryWorker.js` uses
  `response_format: { type: "json_object" }` but wraps `JSON.parse` in try/catch
  with `{ summary: rawContent }` fallback for hallucinated non-JSON. Do not
  remove.

## 9. File / directory map

- `worker.js` — Master routing engine. Redis Stream consumption, DB state
  updates, routing logic, chained job spawning (Auto-Handoff).
- `models/Job.js` — Mongoose schema: payload, cron expressions, last results.
- `workers/scraperWorker.js` — Puppeteer instantiation, resource interception,
  `.textContent` extraction, regex sanitization for numerics/raw text.
- `workers/summaryWorker.js` — Groq SDK wrapper. Appends "must output ONLY valid
  JSON", invokes Llama-3, guarantees a parsed object.
- `workers/emailWorker.js` — Resend SDK wrapper. Hardcoded sandbox rules.
- `workers/apiWorker.js` — UNKNOWN, verify in code. Presumed lightweight HTTP
  client for JSON API ingestion.
- `workers/guardWorker.js` — UNKNOWN, verify in code. Presumed numeric threshold
  evaluation for standard scraper runs.
- `src/components/CreateJobModal.jsx` — React form. Conditional payload
  construction by Job Type (bridges Scraper form to accept AI Instructions).
- `src/components/JobList.jsx` — React view. Dynamic rendering of arbitrary LLM
  output keys without a strict schema.
