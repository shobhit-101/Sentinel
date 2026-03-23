require("dotenv").config();
const mongoose = require("mongoose");
const Redis = require("ioredis");
const Job = require("./models/Job");
const { CronExpressionParser } = require('cron-parser');
// 1. Import Specialist Workers (Strategy Pattern)
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

// 3. Infrastructure Setup (Redis Group & MongoDB)
async function setupInfrastructure() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[Worker] Connected to MongoDB");
  } catch (err) {
    console.error("[Worker] MongoDB Connection Error:", err);
  }

  try {
    // Create Consumer Group (MKSTREAM creates the stream if missing)
    await redis.xgroup("CREATE", "sentinel:tasks", GROUP_NAME, "0", "MKSTREAM");
    console.log(`[Worker] Consumer Group "${GROUP_NAME}" initialized.`);
  } catch (err) {
    if (err.message.includes("BUSYGROUP")) {
      // It is perfectly normal for the group to already exist
    } else {
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
      // READ FROM GROUP: ">" ensures we get tasks never assigned to others
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

        // SHIELD: Clean up Redis if the job is deleted or already finished
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

          // 5. THE DISPATCHER (Modular Selection)
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

          // 6. SUCCESS PATH
          job.status = "completed";
          job.resultData = taskResult; 
          job.completedAt = new Date();
          await job.save();
          // 📈 TELEMETRY: Log successful execution
          await redis.incr(`telemetry:${job.user}:success`);
          // 🔄 THE AUTO-HANDOFF (Scraper/API -> Guard)
          // If the job fetched a price AND the user provided guard rules, send it to the Guard!

          if (["api_ninja", "price_scraper"].includes(jobType) && job.payload.guard) {
            console.log(`[Worker] 🔄 Auto-Handoff: Sending ${job.payload.guard.metricName} to Guard...`);
            
            await Job.create({
              user: job.user,
              jobType: "condition_guard",
              status: "pending",
              payload: {
                currentValue: taskResult.value, // The live price we just fetched!
                targetValue: job.payload.guard.targetValue,
                condition: job.payload.guard.condition,
                emailTo: job.payload.guard.emailTo,
                metricName: job.payload.guard.metricName,
                // 🌟 Add this: Default to 60 mins if user didn't specify
                cooldownMinutes: job.payload.guard.cooldownMinutes || 60
              },
              retryCount: 0,
              maxRetries: 3
            });
          }

          // 🔗 THE CHAIN REACTION (Guard -> Email)
          // If the Guard ran and returned 'trigger_email', instantly spawn the Email job!
          // 🔗 THE CHAIN REACTION (Guard -> Email)
          if (jobType === "condition_guard" && taskResult.action === "trigger_email") {
              
            // 🛡️ THE COOLDOWN ENGINE
            // Create a unique Redis key for this specific user and metric (e.g., "cooldown:user123:Bitcoin")
            const cooldownKey = `cooldown:${job.user}:${job.payload.metricName}`;
            
            // Ask Redis: Is this alert currently locked?
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

              // 🔒 Lock the alert in Redis for X minutes
              // setex = "Set with Expiration" (Key, TimeInSeconds, Value)
              const cooldownSeconds = job.payload.cooldownMinutes * 60;
              await redis.setex(cooldownKey, cooldownSeconds, "locked");
            }
          }
          
          // ⏰ THE CRON ENGINE (Recurring Tasks)
          // If this job has a cron string, clone it for the next scheduled time!
// ⏰ THE CRON ENGINE (Recurring Tasks)
          if (job.cronExpression) {
            try {
              // 🌐 RECURRING TASK TIMEZONE CONVERSION
              // Tell the Time Machine to respect the user's local timezone!
              const interval = CronExpressionParser.parse(job.cronExpression, { 
                tz: job.timezone || "UTC" 
              });

              const nextRunDate = interval.next().toDate(); // Outputs pure UTC

              console.log(`[Worker] ⏰ Recurring task detected! Next execution scheduled for: ${nextRunDate}`);

              await Job.create({
                user: job.user,
                jobType: jobType,
                payload: job.payload, 
                cronExpression: job.cronExpression,
                timezone: job.timezone, // 🌟 INHERIT THE TIMEZONE TO THE CLONE
                scheduledAt: nextRunDate, 
                status: "pending",
                retryCount: 0,
                maxRetries: 3
              });
            } catch (cronErr) {
              console.error(`[Worker] ❌ Failed to parse CRON expression: ${cronErr.message}`);
            }
          }

          // Acknowledge and Remove from Stream
          await redis.xack("sentinel:tasks", GROUP_NAME, redisId);
          await redis.xdel("sentinel:tasks", redisId);
          console.log(`[Worker] ✅ Task ${jobId} finished successfully.`);

        } catch (error) {
          // 7. UNIFIED FAILURE/RETRY ARMOR
          console.error(`[Worker] ❌ Task ${jobId} failed: ${error.message}`);

          if (job.retryCount < job.maxRetries) {
            job.retryCount += 1;
            job.status = "pending";
            
            // Exponential Backoff: Wait 30s, 1m, 2m...
            const delayMs = Math.pow(2, job.retryCount) * 30 * 1000;
            job.scheduledAt = new Date(Date.now() + delayMs);
            await job.save();
            
            console.log(`[Worker] ⏳ Retry ${job.retryCount} scheduled in ${delayMs / 1000}s`);
          } else {
            job.status = "failed";
            job.errorLog = error.message;
            job.completedAt = new Date(); // 🌟 ADD THIS LINE to fix the zombie bug!
            await job.save();
            // 📉 TELEMETRY: Log failed execution
            await redis.incr(`telemetry:${job.user}:failed`);
            console.log(`[Worker] 💀 Job ${jobId} permanently failed.`);
          }

          // Always ACK so it leaves the PEL (Pending Entries List)
          await redis.xack("sentinel:tasks", GROUP_NAME, redisId);
          await redis.xdel("sentinel:tasks", redisId);
        }
      }
    } catch (err) {
      console.error("[Worker] Global Loop Error:", err);
      await new Promise(res => setTimeout(res, 2000)); // Cool-down on major error
    }
  }
}

// Start the worker
processTasks();