const mongoose = require('mongoose');

const PayrollRunSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    // Period & hours info
    periodStart: Date,
    periodEnd: Date,
    hoursWorked: Number,
    hourlyRate: Number,

    // Per-period amounts (match route field names)
    grossPay: Number,
    netPay: Number,
    federalIncomeTax: Number,
    stateIncomeTax: Number,
    socialSecurity: Number,
    medicare: Number,
    totalTaxes: Number,

    // ✅ YTD totals (match what you put in PayrollRun.create)
    ytdGrossPay: Number,
    ytdNetPay: Number,
    ytdFederalIncomeTax: Number,
    ytdStateIncomeTax: Number,
    ytdSocialSecurity: Number,
    ytdMedicare: Number,
    ytdTotalTaxes: Number,

    notes: String,
    payDate: Date,
  },
  {
    timestamps: true,
  }
);

// Export as PayrollRun to match: const PayrollRun = require('../models/PayrollRun');
module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
