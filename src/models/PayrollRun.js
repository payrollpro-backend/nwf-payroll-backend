const mongoose = require('mongoose');

const PayrollRunSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

  periodStart: Date,
  periodEnd: Date,
  hoursWorked: Number,
  hourlyRate: Number,

  grossPay: Number,
  netPay: Number,

  federalIncomeTax: Number,
  stateIncomeTax: Number,
  socialSecurity: Number,
  medicare: Number,
  totalTaxes: Number,
  notes: String,

  payDate: Date, // helpful for YTD queries
}, { timestamps: true });

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
