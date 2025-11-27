const mongoose = require('mongoose');

const PaystubSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
  payDate: Date,
  fileName: String,
}, { timestamps: true });

module.exports = mongoose.model('Paystub', PaystubSchema);
