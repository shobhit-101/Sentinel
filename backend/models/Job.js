const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // 1. WHAT to do (The Worker Router)
  jobType: { 
    type: String,
    required: true,
    // Synchronized with our 4 "Elite" themes
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
    enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
    default: "pending"
  },
  
  // 4. THE OUTPUT (Where the "finds" are stored)
  resultData: {
    type: mongoose.Schema.Types.Mixed,
    default: null // This will hold the AI summary, the scraped price, etc.
  },
  
  // 5. WHEN to do it
  scheduledAt: {
    type: Date,
    default: Date.now 
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
  // 🌟 THE CRON FIELD (Optional)
  cronExpression: { // 🌟 ADD THIS FIELD
    type: String,
    required: false
  },

  // 7. OWNERSHIP
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  timezone: { // 🌟 ADD THIS
    type: String,
    default: "UTC"
  },
  completedAt: {
    type: Date,
    required: false
  },
  lastResult: { type: mongoose.Schema.Types.Mixed }, // 'Mixed' allows saving objects, strings, or numbers!
  lastRunAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("Job", jobSchema);