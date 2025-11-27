const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },

  // Per-period amounts
  grossPay: Number,
  netPay: Number,
  federalTax: Number,
  stateTax: Number,
  ficaTax: Number,

  periodStart: Date,
  periodEnd: Date,
  payDate: Date,

  // ✅ YTD totals
  ytdGross: Number,
  ytdNet: Number,
  ytdFederalTax: Number,
  ytdStateTax: Number,
  ytdFicaTax: Number,
});

module.exports = mongoose.model('Payroll', PayrollSchema);
