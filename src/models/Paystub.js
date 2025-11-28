// src/models/Paystub.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const PaystubSchema = new Schema(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    payrollRun: {
      type: Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
    },
    payDate: {
      type: Date,
      required: true,
    },

    // filename used when downloading (nwf_Emp_ID_xxx_YYYY-MM-DD.pdf)
    fileName: {
      type: String,
      required: true,
    },

    // Snapshot of this period’s amounts (mirror PayrollRun)
    grossPay: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    federalIncomeTax: { type: Number, default: 0 },
    stateIncomeTax: { type: Number, default: 0 },
    socialSecurity: { type: Number, default: 0 },
    medicare: { type: Number, default: 0 },
    totalTaxes: { type: Number, default: 0 },

    // YTD snapshot at the time this stub was created
    ytdGross: { type: Number, default: 0 },
    ytdNet: { type: Number, default: 0 },
    ytdFederalIncomeTax: { type: Number, default: 0 },
    ytdStateIncomeTax: { type: Number, default: 0 },
    ytdSocialSecurity: { type: Number, default: 0 },
    ytdMedicare: { type: Number, default: 0 },
    ytdTotalTaxes: { type: Number, default: 0 },

    // Optional: metadata hash so you can detect tampering later
    metadataHash: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Paystub', PaystubSchema);
