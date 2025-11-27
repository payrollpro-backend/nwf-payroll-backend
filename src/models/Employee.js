const mongoose = require('mongoose');

// Utility for generating employee IDs if you use that feature
function generateEmployeeId() {
  const prefix = 'EMP';
  const random = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  return `${prefix}${random}`;
}

const EmployeeSchema = new mongoose.Schema(
  {
    // ================================
    // BASIC EMPLOYEE INFORMATION
    // ================================
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    email:     { type: String, required: true },

    phone:     { type: String },
    ssn:       { type: String },    // if you’re storing SSN encrypted, update later

    // EMPLOYEE ID
    externalEmployeeId: {
      type: String,
      default: generateEmployeeId,
    },

    // ================================
    // ADDRESS INFORMATION
    // ================================
    address: {
      line1:      { type: String },
      city:       { type: String },
      state:      { type: String },
      postalCode: { type: String },
    },

    // ================================
    // EMPLOYMENT DETAILS
    // ================================
    startDate: { type: Date },

    payFrequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
      default: 'biweekly',
    },

    hourlyRate: { type: Number, required: false, default: 0 },


    // ================================
    // TAX RATES
    // ================================
    federalWithholdingRate: { type: Number, default: 0.18 },
    stateWithholdingRate:   { type: Number, default: 0.05 },

    // ================================
    // PORTAL ACCESS ACCOUNTING
    // ================================
    hasPortalAccount: {
      type: Boolean,
      default: false,
    },

    portalUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Employee', EmployeeSchema);
