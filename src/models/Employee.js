// src/models/Employee.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const EmployeeSchema = new Schema(
  {
    // Link to employer (company)
    employer: { type: Schema.Types.ObjectId, ref: 'Employer', default: null },

    // ----------------------------------------------------------------
    // ✅ NEW: SELF-ONBOARDING FIELDS
    // ----------------------------------------------------------------
    invitationToken: { type: String, default: null }, // Stores the unique link token
    onboardingCompleted: { type: Boolean, default: false }, // True once they finish setup
    
    // Status can now include 'invited'
    status: {
      type: String,
      enum: ['active', 'inactive', 'invited', 'pending'],
      default: 'active',
    },

    // ----------------------------------------------------------------
    // BASIC IDENTITY
    // ----------------------------------------------------------------
    firstName: { type: String, required: true },
    middleName: { type: String, default: '' }, // Added to match forms
    lastName: { type: String, required: true },

    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },

    // ✅ ADDED: Sensitive info the employee enters during onboarding
    ssn: { type: String, default: '' }, 
    dob: { type: Date, default: null },
    gender: { type: String, default: '' },

    // ----------------------------------------------------------------
    // AUTH
    // ----------------------------------------------------------------
    passwordHash: { type: String },
    role: {
      type: String,
      enum: ['admin', 'employer', 'employee'],
      default: 'employee',
    },

    // External / display employee ID like Emp_ID_XXXXXXXXX
    externalEmployeeId: { type: String, default: '' },
    companyName: { type: String, default: '' },

    // Mailing address
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
    },

    // ----------------------------------------------------------------
    // BANKING
    // ----------------------------------------------------------------
    payMethod: {
      type: String,
      enum: ['direct_deposit', 'check'],
      default: 'direct_deposit',
    },

    directDeposit: {
      accountType: { type: String, default: 'Checking' }, 
      bankName: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      // ✅ ADDED: Full account number needed for payroll processing
      accountNumber: { type: String, default: '' }, 
      accountNumberLast4: { type: String, default: '' },
    },

    // ----------------------------------------------------------------
    // PAY CONFIGURATION
    // ----------------------------------------------------------------
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

    startDate: {
      type: Date,
      default: Date.now,
    },

    // ----------------------------------------------------------------
    // TAX / W-4 INFO
    // ----------------------------------------------------------------
    filingStatus: {
      type: String,
      enum: ['single', 'married', 'head_of_household'],
      default: 'single',
    },
    
    // ✅ ADDED: State filing status often differs from Federal
    stateFilingStatus: { type: String, default: 'single' },

    federalWithholdingRate: { type: Number, default: 0 }, 
    stateWithholdingRate: { type: Number, default: 0 },   

    federalAllowances: { type: Number, default: 0 },
    stateAllowances: { type: Number, default: 0 },

    extraFederalWithholding: { type: Number, default: 0 },
    extraStateWithholding: { type: Number, default: 0 },

    stateCode: { type: String, default: '' },
    
    // Checkboxes from UI
    isOfficer: { type: Boolean, default: false },
    isContractor: { type: Boolean, default: false },
    isStatutory: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', EmployeeSchema);
