require("dotenv").config();
const mongoose = require("mongoose");
const Redis = require("ioredis");
const Job = require("./models/Job");
const { CronExpressionParser } = require('cron-parser');

// 1. Import Specialist Workers
const apiWorker = require('./workers/apiWorker');
const scrapeWorker = require('./workers/scraperWorker');
const summaryWorker = require('./workers/summaryWorker');
const emailWorker = require('./workers/emailWorker');
const guardWorker = require('./workers/guardWorker');

// jobType -> worker module. Keys must match models/Job.js JOB_TYPES exactly;
// drift is rejected at startup below.
const DISPATCH = {
  api_ninja: apiWorker,
  price_scraper: scrapeWorker,
  keyword_alert: scrapeWorker,
  condition_guard: guardWorker,
  content_summary: summaryWorker,
  send_email: emailWorker,
};

(function assertDispatchMatchesSchema() {
  const schemaTypes = new Set(Job.JOB_TYPES);
  const dispatchTypes = new Set(Object.keys(DISPATCH));
  const missingDispatch = [...schemaTypes].filter(t => !dispatchTypes.has(t));
  const missingSchema = [...dispatchTypes].filter(t => !schemaTypes.has(t));
  if (missingDispatch.length || missingSchema.length) {
    const msg = [
      'SSOT violation between Job schema enum and worker dispatch:',
      missingDispatch.length ? `  in schema, not dispatched: ${missingDispatch.join(', ')}` : null,
      missingSchema.length ? `  dispatched, not in schema:    ${missingSchema.join(', ')}` : null
    ].filter(Boolean).join('\n');
    throw new Error(msg);
  }
})();

// 2. Configuration & Constants
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
});

const GROUP_NAME = "sentinel_workers";
const CONSUMER_NAME = "worker_1";

// Distinguish transient (retry) vs permanent (fail fast) errors.
// Conservative: retry only when we recognize a transient signal.
function isRetryable(err) {
  if (!err) return false;

  const transientCodes = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT',
    'ENOTFOUND', 'EAI_AGAIN', 'ECONNABORTED',
    'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH'
  ]);
  if (err.code && transientCodes.has(err.code)) return true;

  const status = err.response?.status ?? err.statusCode;
  if (typeof status === 'number') {
    return status === 408 || status === 429 || (status >= 500 && status < 600);
  }

  return false;
}

// 🧹 PEL SWEEPER
// If a previous worker died between xreadgroup and xack, the message is stuck
// in the consumer-group's Pending Entries List forever. XREADGROUP with ">"
// will never re-deliver it. This sweeper reclaims any message idle longer
// than PEL_IDLE_THRESHOLD_MS, then xack+xdel without re-executing. The Mongo
// reaper in index.js handles re-execution by resetting the job to "pending",
// so the normal pending -> poller -> stream flow re-pushes it cleanly.
const PEL_IDLE_THRESHOLD_MS = Number(process.env.PEL_IDLE_THRESHOLD_MS) || 5 * 60 * 1000;
const SWEEPER_INTERVAL_MS = Number(process.env.SWEEPER_INTERVAL_MS) || 60 * 1000;

async function sweepPEL() {
  try {
    const result = await redis.xautoclaim(
      "sentinel:tasks",
      GROUP_NAME,
      CONSUMER_NAME,
      PEL_IDLE_THRESHOLD_MS,
      "0-0",
      "COUNT", 100
    );
    if (!Array.isArray(result)) return;
    const messages = Array.isArray(result[1]) ? result[1] : [];

    for (const entry of messages) {
      if (!entry) continue;
      const [redisId, data] = entry;
      const jobId = Array.isArray(data) ? data[1] : "unknown";
      await redis.xack("sentinel:tasks", GROUP_NAME, redisId);
      await redis.xdel("sentinel:tasks", redisId);
      console.log(`[Worker] 🧹 Swept orphan PEL message ${redisId} (job ${jobId}).`);
    }
  } catch (err) {
    console.error("[Worker] PEL sweep error:", err.message);
  }
}

// 3. Infrastructure Setup
async function setupInfrastructure() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[Worker] Connected to MongoDB");
  } catch (err) {
    console.error("[Worker] MongoDB Connection Error:", err);
  }

  try {
    await redis.xgroup("CREATE", "sentinel:tasks", GROUP_NAME, "0", "MKSTREAM");
    console.log(`[Worker] Consumer Group "${GROUP_NAME}" initialized.`);
  } catch (err) {
    if (!err.message.includes("BUSYGROUP")) {
      console.error("[Worker] Redis Setup Error:", err);
    }
  }
}

// 4. The Master Router Logic
async function processTasks() {
  await setupInfrastructure();
  console.log(`[Worker] ${CONSUMER_NAME} standing by in group "${GROUP_NAME}"...`);

  // Run a sweep immediately to clean any orphans left by a previous crash,
  // then on a fixed interval to catch ones from future crashes.
  sweepPEL();
  setInterval(sweepPEL, SWEEPER_INTERVAL_MS);

  while (true) {
    try {
      const result = await redis.xreadgroup(
        "GROUP", GROUP_NAME, CONSUMER_NAME,
        "BLOCK", 0,
        "STREAMS", "sentinel:tasks", ">"
      );

      if (!result) continue;

      const [stream, messages] = result[0];

      for (const message of messages) {
        const [redisId, data] = message;
        const jobId = data[1];
        const jobType = data[3];

        const job = await Job.findById(jobId);

        if (!job || ["completed", "failed"].includes(job.status)) {
          await redis.xack("sentinel:tasks", GROUP_NAME, redisId);
          await redis.xdel("sentinel:tasks", redisId);
          continue;
        }

        console.log(`[Worker] 🚦 Routing ${jobType} (ID: ${jobId})...`);
        job.status = "processing";
        await job.save();

        try {
          // 5. THE DISPATCHER
          const handler = DISPATCH[jobType];
          if (!handler) {
            throw new Error(`Unsupported jobType: ${jobType}`);
          }
          const taskResult = await handler.execute(job);

          // 6. SUCCESS PATH & DATA SAVING
          job.lastResult = taskResult; 
          job.lastRunAt = new Date();
          
          await redis.incr(`telemetry:${job.user}:success`);

          // 🔄 THE AUTO-HANDOFF (The Fork in the Road)
          const hasGuard = job.payload.guard && job.payload.guard.targetValue !== undefined && job.payload.guard.targetValue !== '';
          const hasAI = job.payload.aiInstructions && job.payload.aiInstructions.trim() !== '';
          const hasEmailResults = job.payload.emailResultsTo && job.payload.emailResultsTo.trim() !== '';

          if (["api_ninja", "price_scraper"].includes(jobType)) {
            // BRANCH A: Scraper to AI
            if (hasAI) {
              console.log(`[Worker] 🔄 Auto-Handoff: Sending Scraped Text to AI Worker...`);
              await Job.create({
                user: job.user,
                jobType: "content_summary",
                status: "pending",
                payload: {
                  sourceText: taskResult.originalText || String(taskResult.value), // Pass raw scraped text
                  aiInstructions: job.payload.aiInstructions,
                 emailTo: job.payload.emailTo || (job.payload.guard ? job.payload.guard.emailTo : ''),
                },
                retryCount: 0,
                maxRetries: 3
              });
            } 
            // BRANCH B: Scraper to Guard
            else if (hasGuard) {
              console.log(`[Worker] 🔄 Auto-Handoff: Sending ${job.payload.guard.metricName} to Guard...`);
              await Job.create({
                user: job.user,
                jobType: "condition_guard",
                status: "pending",
                payload: {
                  currentValue: taskResult.value, 
                  targetValue: job.payload.guard.targetValue,
                  condition: job.payload.guard.condition,
                  emailTo: job.payload.guard.emailTo,
                  metricName: job.payload.guard.metricName,
                  cooldownMinutes: job.payload.guard.cooldownMinutes || 60
                },
                retryCount: 0,
                maxRetries: 3
              });
            }
            // BRANCH C: Mail the fetched result directly (no threshold, no AI)
            else if (hasEmailResults) {
              console.log(`[Worker] 🔄 Auto-Handoff: Mailing fetched result...`);
              await Job.create({
                user: job.user,
                jobType: "send_email",
                status: "pending",
                payload: {
                  to: job.payload.emailResultsTo,
                  subject: `📡 Sentinel: ${job.payload.label || 'Monitor update'}`,
                  body: String(taskResult.value)
                },
                retryCount: 0,
                maxRetries: 3
              });
            }
          }

          // 🧠 AI AUTO-HANDOFF (AI -> Email)
          if (jobType === "content_summary" && job.payload.emailTo && job.payload.emailTo.trim() !== '') {
            console.log(`[Worker] 🔄 Auto-Handoff: Sending AI response to Email...`);

            // The AI pipeline is free-form: email exactly what the model returned.
            const dynamicBody = taskResult.response || "(no response)";

            await Job.create({
              user: job.user,
              jobType: "send_email",
              status: "pending",
              payload: {
                to: job.payload.emailTo,
                subject: `🧠 Sentinel AI Report`,
                body: dynamicBody
              },
              retryCount: 0,
              maxRetries: 3
            });
          }

          // 🔗 THE CHAIN REACTION (Guard -> Email)
          if (jobType === "condition_guard" && taskResult.action === "trigger_email") {
            const cooldownKey = `cooldown:${job.user}:${job.payload.metricName}`;
            const onCooldown = await redis.get(cooldownKey);

            if (onCooldown) {
              console.log(`[Worker] 🧊 Alert suppressed for ${job.payload.metricName}. Cooldown is active.`);
            } else {
              console.log(`[Worker] 🚨 Alert Triggered! Spawning email notification job...`);
              await Job.create({
                user: job.user,
                jobType: "send_email",
                status: "pending",
                payload: taskResult.emailPayload,
                retryCount: 0,
                maxRetries: 3
              });

              const cooldownSeconds = job.payload.cooldownMinutes * 60;
              await redis.setex(cooldownKey, cooldownSeconds, "locked");
            }
          }
          
          // ⏰ THE CRON ENGINE
          if (job.cronExpression) {
            try {
              const interval = CronExpressionParser.parse(job.cronExpression, { 
                tz: job.timezone || "UTC" 
              });

              job.scheduledAt = interval.next().toDate(); 
              job.status = "pending"; 
              await job.save();

              console.log(`[Worker] ⏰ CRON updated! Next execution scheduled for: ${job.scheduledAt}`);
            } catch (cronErr) {
              console.error(`[Worker] ❌ Failed to parse CRON expression: ${cronErr.message}`);
              job.status = "failed";
              await job.save();
            }
          } else {
            job.status = "completed";
            job.completedAt = new Date();
            await job.save();
          }

          await redis.xack("sentinel:tasks", GROUP_NAME, redisId);
          await redis.xdel("sentinel:tasks", redisId);
          console.log(`[Worker] ✅ Task ${jobId} finished successfully.`);

        } catch (error) {
          console.error(`[Worker] ❌ Task ${jobId} failed: ${error.message}`);

          const retryable = isRetryable(error);

          if (retryable && job.retryCount < job.maxRetries) {
            job.retryCount += 1;
            job.status = "pending";

            const delayMs = Math.pow(2, job.retryCount) * 30 * 1000;
            job.scheduledAt = new Date(Date.now() + delayMs);
            await job.save();

            console.log(`[Worker] ⏳ Retry ${job.retryCount} scheduled in ${delayMs / 1000}s (transient)`);
          } else {
            job.status = "failed";
            job.errorLog = error.message;
            job.completedAt = new Date();
            await job.save();

            await redis.incr(`telemetry:${job.user}:failed`);
            const reason = retryable ? "max retries exhausted" : "non-retryable error";
            console.log(`[Worker] 💀 Job ${jobId} permanently failed (${reason}).`);
          }

          await redis.xack("sentinel:tasks", GROUP_NAME, redisId);
          await redis.xdel("sentinel:tasks", redisId);
        }
      }
    } catch (err) {
      console.error("[Worker] Global Loop Error:", err);
      await new Promise(res => setTimeout(res, 2000));
    }
  }
}

processTasks();