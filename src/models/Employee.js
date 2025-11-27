const mongoose = require('mongoose');
const EmployeeSchema = new mongoose.Schema({
  // ...existing fields...

  address: {
    line1: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String }
  },

  startDate: {
    type: Date,
    required: false // you can flip to true once you’ve updated data
  },

  payFrequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly'],
    default: 'biweekly'
  },

  hourlyRate: {
    type: Number,
    required: true
  },

  // existing: externalEmployeeId, role, etc...
});
const EmployeeSchema = new mongoose.Schema({
  // Which employer they belong to (null for NWF internal admin)
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', default: null },

  // Login / identity
  firstName: String,
  lastName: String,
  email: { type: String, required: true, unique: true },
  phone: String,
  passwordHash: String,

  // 'admin' (NWF), 'employer' (client portal), 'employee' (worker)
  role: {
    type: String,
    enum: ['admin', 'employer', 'employee'],
    default: 'employee',
  },

  // For payroll employees
  externalEmployeeId: { type: String, unique: true, sparse: true }, // Emp_ID_938203948

  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,  // 2-letter state
    zip: String,
  },
  dateOfBirth: Date,
  ssnLast4: String,

  payMethod: {
    type: String,
    enum: ['direct_deposit', 'paper_check'],
    default: 'direct_deposit',
  },
  directDeposit: {
    bankName: String,
    routingLast4: String,
    accountLast4: String,
    accountType: {
      type: String,
      enum: ['checking', 'savings'],
      default: 'checking',
    },
  },

  companyName: String,
  hourlyRate: { type: Number, default: 0 },

  federalWithholdingRate: { type: Number, default: 0.18 },
  stateWithholdingRate: { type: Number, default: 0.05 },
}, { timestamps: true });

module.exports = mongoose.model('Employee', EmployeeSchema);
