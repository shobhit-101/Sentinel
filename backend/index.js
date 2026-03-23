require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose= require("mongoose");
const cronParser = require('cron-parser');
const Job = require("./models/Job");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");
const moment = require('moment-timezone');
const Redis = require("ioredis");
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());// middleware to parse JSON bodies

// 1. Connect to the local Docker Redis bubble
const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});
app.post("/auth/signup",async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "All fields required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }
    
    const user = await User.create({ email, password });

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

    res.json({ success: true, token});
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});
app.get("/protected", auth, (req, res) => {
  res.json({
    success: true,
    userId: req.userId
  });
});

app.get("/", (req, res) => {
  res.send("Backend running");
});

// async function testUser() {
//   const user = await User.create({
//     email: "test@test.com",
//     password: "password123"
//   });
//   console.log(user);
// }

// testUser();


app.get("/jobs",auth, async (req, res) => {
  try {
    const jobs = await Job.find({ user: req.userId });
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});
app.post("/jobs", auth, async (req, res) => {
  try {
    // 1. Extract all fields, including the new timezone field
    const { jobType, payload, scheduledAt, cronExpression, timezone } = req.body;

    // 2. Update validation for the new fields
    if (!jobType || !payload) {
      return res.status(400).json({
        success: false,
        error: "Both jobType and payload are required"
      });
    }

    // 3. Timezone & Scheduling Logic
    const userTz = timezone || "UTC"; // Default to UTC if not provided
    let finalScheduledAt = new Date(); // Defaults to right now (UTC)

    // 🌐 STATIC TASK TIMEZONE CONVERSION
    if (scheduledAt) {
      // Translate the provided date string and timezone into pure UTC
      finalScheduledAt = moment.tz(scheduledAt, userTz).toDate();
    }

    // 4. Create the job using the updated schema fields
    const job = await Job.create({
      jobType,
      payload,
      cronExpression, 
      timezone: userTz, // Save their timezone preference for future CRON clones
      user: req.userId,
      status: "pending",
      scheduledAt: finalScheduledAt // Save the pure UTC date
    });

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (err) {
    // 5. Catch Mongoose Enum Validation Errors specifically
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: err.message // Tells the user if they used an invalid jobType
      });
    }

    // 6. Standard fallback error
    console.error("Error creating job:", err);
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});


// GET /stats - Fetch User Telemetry for Dashboard
app.get("/stats", auth, async (req, res) => {
  try {
    const successCount = await redis.get(`telemetry:${req.userId}:success`) || 0;
    const failedCount = await redis.get(`telemetry:${req.userId}:failed`) || 0;
    const activeJobs = await Job.countDocuments({ user: req.userId, status: "pending" });

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


app.delete("/jobs/:id",auth, async (req, res) => {
  try {
    const { id } = req.params;
          const job = await Job.findOne({
          _id: id,
          user: req.userId
        });

    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found"
      });
    }

    await job.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});


// app.put("/tasks/:id", (req, res) => {
//   const { id } = req.params;

//   const task = tasks.find(t => t.id === id);

//   if (!task) {
//     return res.status(404).json({
//       success: false,
//       error: "Task not found"
//     });
//   }
 
//   task.completed = !task.completed;

//   res.json({
//     success: true,
//     data: task
//   });
// });
app.put("/jobs/:id",auth, async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findOne({
  _id: id,
  user: req.userId
});


    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found"
      });
    }

    job.status = job.status === "pending" ? "paused" : "pending";
    await job.save();

    res.json({
      success: true,
      data: job
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});





// ==========================================
// 🏗️ THE SENTINEL POLLER (Leader)
// ==========================================
const POLLING_INTERVAL = 5000; // 5 seconds

setInterval(async () => {
  try {
    // 2. Ask Mongo: Are there any pending jobs where the scheduled time has passed?
    const dueJobs = await Job.find({
      status: "pending",
      scheduledAt: { $lte: new Date() } // $lte = Less Than or Equal To right now
    });

    if (dueJobs.length > 0) {
      console.log(`[Poller] Found ${dueJobs.length} due tasks. Moving to Conveyor Belt...`);
    }

    // 3. Move each job to Redis
    for (const job of dueJobs) {
      // Push to a Redis Stream named "sentinel:tasks"
      await redis.xadd(
        "sentinel:tasks", 
        "*", // Tells Redis to auto-generate a unique ID for this message
        "jobId", job._id.toString(), 
        "jobType", job.jobType
      );

      // 4. Update the database so we don't pick it up again
      job.status = "queued";
      await job.save();
      
      console.log(`[Poller] Task ${job._id} successfully queued in Redis.`);
    }
  } catch (err) {
    console.error("[Poller] Error fetching due jobs:", err);
  }
}, POLLING_INTERVAL);

// ==========================================
// 🗑️ THE GARBAGE COLLECTOR (Runs every 1 hour)
// ==========================================
setInterval(async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Delete jobs that are completed/failed and older than 7 days
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
}, 60 * 60 * 1000); // 1 hour
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
