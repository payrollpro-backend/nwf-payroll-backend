// src/models/Paystub.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Schema } = mongoose;

const PaystubSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    // ✅ ADDED: Employer field is required for PDF generation
    employer: { type: Schema.Types.ObjectId, ref: 'Employee' }, 
    payrollRun: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true },

    payDate: { type: Date, required: true },
    
    // Pay Period Dates
    payPeriodStart: { type: Date },
    payPeriodEnd: { type: Date },

    fileName: { type: String, required: true },

    checkNumber: {
      type: String,
      default: () => String(Math.floor(100000000 + Math.random() * 900000000)),
    },

    bankName: { type: String, default: 'FIRST NATIONAL BANK' },
    verificationCode: {
      type: String,
      default: () => crypto.randomBytes(3).toString('hex').toUpperCase(),
    },

    // Financials
    grossPay: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    federalIncomeTax: { type: Number, default: 0 },
    stateIncomeTax: { type: Number, default: 0 },
    socialSecurity: { type: Number, default: 0 },
    medicare: { type: Number, default: 0 },
    totalTaxes: { type: Number, default: 0 },

    // YTD Snapshots
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

module.exports = mongoose.model('Paystub', PaystubSchema);
