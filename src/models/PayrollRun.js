const mongoose = require('mongoose');

const PayrollRunSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    hoursWorked: { type: Number, required: true },
    grossPay: { type: Number, required: true },
    netPay: { type: Number, required: true },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);