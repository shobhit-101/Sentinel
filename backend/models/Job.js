const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // 1. WHAT to do (The Worker Router)
  jobType: { 
    type: String,
    required: true,
    enum: [
      'send_email', 
      'price_scraper',
      'api_ninja',
      'keyword_alert', 
      'condition_guard', 
      'content_summary'
    ], 
    trim: true
  },
  
  // 2. THE DATA to do it with
  payload: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true
  },
  
  // 3. THE LIFECYCLE (State Machine)
  status: {
    type: String,
    // 🌟 ADDED 'paused' to prevent frontend crash when pausing tasks!
    enum: ['pending', 'paused', 'queued', 'processing', 'completed', 'failed'],
    default: "pending"
  },
  
  // 4. THE OUTPUT (Observability for the Dashboard)
  resultData: {
    type: mongoose.Schema.Types.Mixed,
    default: null 
  },
  lastResult: { 
    type: mongoose.Schema.Types.Mixed // Allows saving JSON objects from our AI Analyst
  }, 
  lastRunAt: { 
    type: Date 
  },
  
  // 5. WHEN to do it
  scheduledAt: {
    type: Date,
    default: Date.now 
  },
  cronExpression: { 
    type: String,
    required: false
  },
  timezone: { 
    type: String,
    default: "UTC"
  },

  // 6. RESILIENCE (Exponential Backoff & DLQ)
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3 
  },
  errorLog: {
    type: String,
    default: null
  },

  // 7. OWNERSHIP
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  completedAt: {
    type: Date,
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model("Job", jobSchema);