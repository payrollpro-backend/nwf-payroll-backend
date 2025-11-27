const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  // keep your existing fields:
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true },
  // ...whatever you already had here (externalEmployeeId, hourlyRate, etc)...

  // add NEW fields here (instead of making a second schema):

  address: {
    line1:      { type: String },
    city:       { type: String },
    state:      { type: String },
    postalCode: { type: String },
  },

  startDate: {
    type: Date,
  },

  payFrequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly'],
    default: 'biweekly',
  },

  hasPortalAccount: {
    type: Boolean,
    default: false,
  },

  portalUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true, // if you already had this, keep it
});

module.exports = mongoose.model('Employee', EmployeeSchema);
