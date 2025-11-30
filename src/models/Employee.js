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

    // External / display employee ID like Emp_ID_XXXXXXXXX
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
      accountType: { type: String, default: '' }, // checking / savings
      bankName: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      accountNumberLast4: { type: String, default: '' }, // store last 4 only
    },

    /**
     * Pay configuration
     * - payType: hourly vs salary
     * - payFrequency: weekly, biweekly, semimonthly, monthly
     */
    payType: {
      type: String,
      enum: ['hourly', 'salary'],
      default: 'hourly',
    },

    hourlyRate: { type: Number, default: 0 },   // used when payType = 'hourly'
    salaryAmount: { type: Number, default: 0 }, // annual salary when payType = 'salary'

    payFrequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
      default: 'biweekly',
    },

    // Hire date used for YTD context (earlier than this is effectively 0)
    hireDate: {
      type: Date,
      default: Date.now,
    },

    // start date (front-end "startDate" field)
    startDate: {
      type: Date,
      default: Date.now,
    },

    // active / inactive status
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    // optional stored “default” tax settings for employee
    federalWithholdingRate: { type: Number, default: 0 }, // e.g. 0.18 for 18%
    stateWithholdingRate: { type: Number, default: 0 },   // e.g. 0.05
  },
  { timestamps: true }
);

// 🔹 Auto-generate a unique externalEmployeeId if empty
EmployeeSchema.pre('save', function (next) {
  if (!this.externalEmployeeId) {
    const random = Math.floor(100000000 + Math.random() * 900000000); // 9-digit number
    this.externalEmployeeId = `Emp_ID_${random}`;
  }
  next();
});

module.exports = mongoose.model('Employee', EmployeeSchema);
