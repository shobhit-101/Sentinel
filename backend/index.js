
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const Redis = require("ioredis");

const Job = require("./models/Job");
const Task = require("./models/Task");
const User = require("./models/User");
const auth = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

// Reject malformed :id route params with 400 instead of letting a Mongoose
// CastError fall through to the generic 500 handler.
app.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid id format" });
  }
  next();
});

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
});

// ==========================================
// 🔐 AUTHENTICATION ROUTES
// ==========================================
app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "All fields required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }
    
    await User.create({ email, password });
    res.status(201).json({ success: true, message: "User created" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "All fields required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get("/protected", auth, (req, res) => {
  res.json({ success: true, userId: req.userId });
});

app.get("/", (req, res) => {
  res.send("Sentinel Backend Running");
});

// ==========================================
// 🗂️ JOB MANAGEMENT ROUTES
// ==========================================
app.get("/jobs", auth, async (req, res) => {
  try {
    const jobs = await Job.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.post("/jobs", auth, async (req, res) => {
  try {
    const { jobType, payload, scheduledAt, cronExpression, timezone } = req.body;

    if (!jobType || !payload) {
      return res.status(400).json({ success: false, error: "Both jobType and payload are required" });
    }

    const userTz = timezone || "UTC"; 
    let finalScheduledAt = new Date(); 

    if (scheduledAt) {
      finalScheduledAt = moment.tz(scheduledAt, userTz).toDate();
    }

    const job = await Job.create({
      jobType,
      payload,
      cronExpression, 
      timezone: userTz, 
      user: req.userId,
      status: "pending",
      scheduledAt: finalScheduledAt 
    });

    res.status(201).json({ success: true, data: job });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error("Error creating job:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.delete("/jobs/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findOne({ _id: id, user: req.userId });

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    await job.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.put("/jobs/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findOne({ _id: id, user: req.userId });

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    job.status = job.status === "pending" ? "paused" : "pending";
    await job.save();

    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 🌟 PHASE 3: NEW ROUTE TO INSTANTLY COMPLETE/UNCOMPLETE STATIC TASKS
app.put("/jobs/:id/complete", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findOne({ _id: id, user: req.userId });

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    // Toggle logic
    job.status = job.status === "completed" ? "pending" : "completed";
    job.completedAt = job.status === "completed" ? new Date() : null;
    
    await job.save();

    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ==========================================
// ✅ STATIC TASK ROUTES (to-do list)
// ==========================================
app.get("/tasks", auth, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.userId }).sort({ completed: 1, createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.post("/tasks", auth, async (req, res) => {
  try {
    const { title, notes, dueDate } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: "Task title is required" });
    }
    const task = await Task.create({
      title: title.trim(),
      notes: notes || '',
      dueDate: dueDate || undefined,
      user: req.userId
    });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.put("/tasks/:id", auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.userId });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const { title, notes, dueDate, completed } = req.body;
    if (title !== undefined) task.title = title.trim();
    if (notes !== undefined) task.notes = notes;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    if (completed !== undefined) {
      task.completed = completed;
      task.completedAt = completed ? new Date() : null;
    }

    await task.save();
    res.json({ success: true, data: task });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.delete("/tasks/:id", auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.userId });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }
    await task.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ==========================================
// 📊 DASHBOARD TELEMETRY ROUTE
// ==========================================
app.get("/stats", auth, async (req, res) => {
  try {
    const successCount = await redis.get(`telemetry:${req.userId}:success`) || 0;
    const failedCount = await redis.get(`telemetry:${req.userId}:failed`) || 0;
    
    const activeJobs = await Job.countDocuments({ 
      user: req.userId, 
      status: { $in: ["pending", "queued", "processing", "paused"] } 
    });

    res.json({
      success: true,
      data: {
        tasksExecuted: parseInt(successCount),
        tasksFailed: parseInt(failedCount),
        activeMonitors: activeJobs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Stats error" });
  }
});

// ==========================================
// 🏗️ THE SENTINEL POLLER (Leader)
// ==========================================
const POLLING_INTERVAL = 5000; 

setInterval(async () => {
  try {
    const dueJobs = await Job.find({
      status: "pending",
      scheduledAt: { $lte: new Date() } 
    });

    if (dueJobs.length > 0) {
      console.log(`[Poller] Found ${dueJobs.length} due tasks. Moving to Conveyor Belt...`);
    }

    for (const job of dueJobs) {
      await redis.xadd(
        "sentinel:tasks", 
        "*", 
        "jobId", job._id.toString(), 
        "jobType", job.jobType
      );

      job.status = "queued";
      await job.save();
      
      console.log(`[Poller] Task ${job._id} successfully queued in Redis.`);
    }
  } catch (err) {
    console.error("[Poller] Error fetching due jobs:", err);
  }
}, POLLING_INTERVAL);

// ==========================================
// 🩹 STALE-PROCESSING REAPER
// ==========================================
// If a worker crashes mid-job, the Mongo record stays on status="processing"
// forever and the Redis PEL holds an orphan. The reaper periodically scans for
// "processing" jobs that haven't been touched in REAPER_THRESHOLD_MS and resets
// them so the normal pending -> poller -> stream flow re-attempts them.
const REAPER_THRESHOLD_MS = Number(process.env.REAPER_THRESHOLD_MS) || 5 * 60 * 1000;
const REAPER_INTERVAL_MS = Number(process.env.REAPER_INTERVAL_MS) || 30 * 1000;

setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - REAPER_THRESHOLD_MS);
    const stuck = await Job.find({
      status: "processing",
      updatedAt: { $lt: cutoff }
    });

    for (const job of stuck) {
      if (job.retryCount < job.maxRetries) {
        job.retryCount += 1;
        job.status = "pending";
        const delayMs = Math.pow(2, job.retryCount) * 30 * 1000;
        job.scheduledAt = new Date(Date.now() + delayMs);
        job.errorLog = "Worker crash detected; job abandoned in processing state.";
        await job.save();
        console.log(`[Reaper] 🩹 Reset stale job ${job._id} (retry ${job.retryCount} in ${delayMs / 1000}s).`);
      } else {
        job.status = "failed";
        job.errorLog = "Abandoned in processing state; max retries exhausted.";
        job.completedAt = new Date();
        await job.save();
        await redis.incr(`telemetry:${job.user}:failed`);
        console.log(`[Reaper] 💀 Stale job ${job._id} permanently failed (max retries).`);
      }
    }
  } catch (err) {
    console.error("[Reaper] Error:", err);
  }
}, REAPER_INTERVAL_MS);

// ==========================================
// 🗑️ THE GARBAGE COLLECTOR
// ==========================================
setInterval(async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await Job.deleteMany({
      status: { $in: ["completed", "failed"] },
      completedAt: { $lt: sevenDaysAgo } 
    });

    if (result.deletedCount > 0) {
      console.log(`[Garbage Collector] 🧹 Swept ${result.deletedCount} old jobs from the database.`);
    }
  } catch (err) {
    console.error("[Garbage Collector] Error:", err);
  }
}, 60 * 60 * 1000); 

// ==========================================
// 🚀 SERVER START
// ==========================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });