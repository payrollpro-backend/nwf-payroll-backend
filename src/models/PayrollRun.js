// src/models/PayrollRun.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PayrollRunSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    employer: { type: Schema.Types.ObjectId, ref: 'Employer', default: null },

    payType: {
      type: String,
      enum: ['hourly', 'salary'],
    },
    payFrequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
    },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    payDate: { type: Date, required: true },

    hoursWorked: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },

    grossPay: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },

    federalIncomeTax: { type: Number, default: 0 },
    stateIncomeTax: { type: Number, default: 0 },
    socialSecurity: { type: Number, default: 0 },
    medicare: { type: Number, default: 0 },
    totalTaxes: { type: Number, default: 0 },

    // YTD snapshots at the moment of this run (calendar year)
    ytdGross: { type: Number, default: 0 },
    ytdNet: { type: Number, default: 0 },
    ytdFederalIncomeTax: { type: Number, default: 0 },
    ytdStateIncomeTax: { type: Number, default: 0 },
    ytdSocialSecurity: { type: Number, default: 0 },
    ytdMedicare: { type: Number, default: 0 },
    ytdTotalTaxes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
