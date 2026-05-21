const mongoose = require('mongoose');

// Static to-do items. Deliberately separate from Job: a Task is something
// the user tracks by hand, not something the orchestration engine executes.
// An optional email reminder is delivered via a companion send_email Job
// (see syncTaskReminder in index.js) scheduled at the due date.
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  dueDate: {
    type: Date
  },
  remindByEmail: {
    type: Boolean,
    default: false
  },
  reminderJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
