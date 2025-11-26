const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    hourlyRate: { type: Number, default: 0 },
    companyName: { type: String, default: 'NWF Payroll Client' },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', EmployeeSchema);