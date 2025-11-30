// src/models/Employee.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const EmployeeSchema = new Schema(
  {
    employer: { type: Schema.Types.ObjectId, ref: 'Employer', default: null },

    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },

    passwordHash: { type: String },
    role: {
      type: String,
      enum: ['admin', 'employer', 'employee'],
      default: 'employee',
    },

    externalEmployeeId: { type: String, default: '' },

    companyName: { type: String, default: '' },

    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
    },

    payMethod: {
      type: String,
      enum: ['direct_deposit', 'check'],
      default: 'direct_deposit',
    },

    directDeposit: {
      accountType: { type: String, default: '' },
      bankName: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      accountNumberLast4: { type: String, default: '' },
    },

    payType: {
      type: String,
      enum: ['hourly', 'salary'],
      default: 'hourly',
    },

    hourlyRate: { type: Number, default: 0 },
    salaryAmount: { type: Number, default: 0 },

    payFrequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
      default: 'biweekly',
    },

    // ✅ NEW Filing Status field
    filingStatus: {
      type: String,
      enum: [
        'single_or_mfs',
        'married_joint',
        'married_separate',
        'head_of_household',
        'qualifying_surviving_spouse'
      ],
      default: 'single_or_mfs',
    },

    hireDate: { type: Date, default: Date.now },

    startDate: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    federalWithholdingRate: { type: Number, default: 0 },
    stateWithholdingRate: { type: Number, default: 0 },

  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', EmployeeSchema);
