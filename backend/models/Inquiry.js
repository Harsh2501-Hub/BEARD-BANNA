const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    default: 'General Support'
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Unread', 'Replied', 'Archived'],
    default: 'Unread'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Inquiry', inquirySchema);
