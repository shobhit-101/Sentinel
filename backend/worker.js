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

// 2. Configuration & Constants
const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

const GROUP_NAME = "sentinel_workers";
const CONSUMER_NAME = "worker_1";

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
          let taskResult;

          // 5. THE DISPATCHER
          switch (jobType) {
            case "api_ninja":
              taskResult = await apiWorker.execute(job);
              break;
            case "price_scraper":
            case "keyword_alert":
              taskResult = await scrapeWorker.execute(job);
              break;
            case "availability_guard":
            case "condition_guard":
              taskResult = await guardWorker.execute(job);
              break;
            case "content_summary":
              taskResult = await summaryWorker.execute(job);
              break;
            case "send_email":
            case "email_notification":
              taskResult = await emailWorker.execute(job);
              break;
            default:
              throw new Error(`Unsupported jobType: ${jobType}`);
          }

          // 6. SUCCESS PATH & DATA SAVING
          job.lastResult = taskResult; 
          job.lastRunAt = new Date();
          
          await redis.incr(`telemetry:${job.user}:success`);

          // 🔄 THE AUTO-HANDOFF (Scraper/API -> Guard)
          // 🌟 We now check if targetValue actually exists to support "Observer Mode"
          const hasGuard = job.payload.guard && job.payload.guard.targetValue !== undefined && job.payload.guard.targetValue !== '';

          if (["api_ninja", "price_scraper"].includes(jobType) && hasGuard) {
            console.log(`[Worker] 🔄 Auto-Handoff: Sending ${job.payload.guard.metricName} to Guard...`);
            await Job.create({
              user: job.user,
              jobType: "condition_guard",
              status: "pending",
              payload: {
                currentValue: taskResult.value, 
                targetValue: job.payload.guard.targetValue,
                condition: job.payload.guard.condition,
                emailTo: job.payload.guard.emailTo, // 🌟 Can be empty now safely
                metricName: job.payload.guard.metricName,
                cooldownMinutes: job.payload.guard.cooldownMinutes || 60
              },
              retryCount: 0,
              maxRetries: 3
            });
          }

          // 🧠 AI AUTO-HANDOFF (Sentiment Analyst -> Email)
          // 🌟 Safely checks if email was provided
          if (jobType === "content_summary" && job.payload.emailTo && job.payload.emailTo.trim() !== '') {
            console.log(`[Worker] 🔄 Auto-Handoff: Sending AI Sentiment Analysis to Email...`);
            await Job.create({
              user: job.user,
              jobType: "send_email",
              status: "pending",
              payload: {
                to: job.payload.emailTo,
                subject: `🧠 Sentinel AI Market Sentiment: ${taskResult.sentiment}`,
                body: `Sentinel AI Analysis Complete:\n\nSentiment: ${taskResult.sentiment}\nConfidence: ${taskResult.score}/100\nReason: ${taskResult.reason}`
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

          if (job.retryCount < job.maxRetries) {
            job.retryCount += 1;
            job.status = "pending";
            
            const delayMs = Math.pow(2, job.retryCount) * 30 * 1000;
            job.scheduledAt = new Date(Date.now() + delayMs);
            await job.save();
            
            console.log(`[Worker] ⏳ Retry ${job.retryCount} scheduled in ${delayMs / 1000}s`);
          } else {
            job.status = "failed";
            job.errorLog = error.message;
            job.completedAt = new Date(); 
            await job.save();
            
            await redis.incr(`telemetry:${job.user}:failed`);
            console.log(`[Worker] 💀 Job ${jobId} permanently failed.`);
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