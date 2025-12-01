// src/models/Employee.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const EmployeeSchema = new Schema(
  {
    // Link to employer (company)
    employer: { type: Schema.Types.ObjectId, ref: 'Employer', default: null },

    // Basic identity
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },

    // Auth
    passwordHash: { type: String },
    role: {
      type: String,
      enum: ['admin', 'employer', 'employee'],
      default: 'employee',
    },

    // External / display employee ID like Emp_ID_XXXXXXXXX
    externalEmployeeId: { type: String, default: '' },

    // Optional “company name” on employee row (for sole props, etc.)
    companyName: { type: String, default: '' },

    // Mailing address
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
    },

    // How they get paid out
    payMethod: {
      type: String,
      enum: ['direct_deposit', 'check'],
      default: 'direct_deposit',
    },

    // Direct deposit info (we only store last4 of account)
    directDeposit: {
      accountType: { type: String, default: '' }, // checking / savings
      bankName: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      accountNumberLast4: { type: String, default: '' },
    },

    /**
     * Pay configuration
     */
    payType: {
      type: String,
      enum: ['hourly', 'salary'],
      default: 'hourly',
    },

    // used when payType = 'hourly'
    hourlyRate: { type: Number, default: 0 },

    // annual salary when payType = 'salary'
    salaryAmount: { type: Number, default: 0 },

    payFrequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
      default: 'biweekly',
    },

    // Hire date used for YTD context
    hireDate: {
      type: Date,
      default: Date.now,
    },

    // Optional “start working this job” date (front-end: startDate)
    startDate: {
      type: Date,
      default: Date.now,
    },

    // active / inactive
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    /**
     * Tax configuration / W-4-style fields
     */

    // Filing status for federal & state withholding
    filingStatus: {
      type: String,
      enum: ['single', 'married', 'head_of_household'],
      default: 'single',
    },

    // Optional flat “percent of gross” overrides (0 = use default logic)
    federalWithholdingRate: { type: Number, default: 0 }, // e.g. 0.18 = 18%
    stateWithholdingRate: { type: Number, default: 0 },   // e.g. 0.05 = 5%

    // Allowances / dependents counts (can be used later for a richer engine)
    federalAllowances: { type: Number, default: 0 },
    stateAllowances: { type: Number, default: 0 },

    // Extra dollar amounts to withhold each paycheck
    extraFederalWithholding: { type: Number, default: 0 },
    extraStateWithholding: { type: Number, default: 0 },

    // Optional state code shortcut (if not using address.state)
    stateCode: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', EmployeeSchema);
