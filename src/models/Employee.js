// src/models/Employee.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const EmployeeSchema = new Schema(
  {
    // Link to employer (company)
    employer: { type: Schema.Types.ObjectId, ref: 'Employer', default: null },

    // ✅ NEW FIELD: Flag to enforce single-user payroll restrictions
    isSelfEmployed: { type: Boolean, default: false },

    // ----------------------------------------------------------------
    // SELF-ONBOARDING FIELDS
    // ----------------------------------------------------------------
    invitationToken: { type: String, default: null },
    onboardingCompleted: { type: Boolean, default: false },
    
    // Force password change flag
    requiresPasswordChange: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['active', 'inactive', 'invited', 'pending'],
      default: 'active',
    },

    // ----------------------------------------------------------------
    // BASIC IDENTITY
    // ----------------------------------------------------------------
    firstName: { type: String, required: true },
    middleName: { type: String, default: '' },
    lastName: { type: String, required: true },

    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },

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

    externalEmployeeId: { 
        type: String, 
        sparse: true,  
        unique: true   
    }, 

    companyName: { type: String, default: '' },

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
    
    // Employee Deposit Account (Personal)
    directDeposit: {
      accountType: { type: String, default: 'Checking' }, 
      bankName: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      accountNumber: { type: String, default: '' }, 
      accountNumberLast4: { type: String, default: '' },
    },
    
    // ✅ NEW FIELD: Business Withdrawal Account (Business Funds Source)
    businessWithdrawalAccount: {
      bankName: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
    },


    // ----------------------------------------------------------------
    // PAY CONFIGURATION
    // ----------------------------------------------------------------
    payType: {
      type: String,
      enum: ['hourly', 'salary'],
      default: 'hourly',
    },

    hourlyRate: { type: Number, default: 0 },
    annualSalary: { type: Number, default: 0 },
payRate: { type: Number, default: 0 }, // legacy mirror (annual)


    payFrequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
      default: 'biweekly',
    },

    hireDate: { type: Date, default: Date.now },
    startDate: { type: Date, default: Date.now },

    // ----------------------------------------------------------------
    // TAX / W-4 INFO
    // ----------------------------------------------------------------
    filingStatus: {
      type: String,
      enum: ['single', 'married', 'head_of_household'],
      default: 'single',
    },
    
    stateFilingStatus: { type: String, default: 'single' },

    federalWithholdingRate: { type: Number, default: 0 }, 
    stateWithholdingRate: { type: Number, default: 0 },   

    federalAllowances: { type: Number, default: 0 },
    stateAllowances: { type: Number, default: 0 },

    extraFederalWithholding: { type: Number, default: 0 },
    extraStateWithholding: { type: Number, default: 0 },

    stateCode: { type: String, default: '' },
    
    isOfficer: { type: Boolean, default: false },
    isContractor: { type: Boolean, default: false },
    isStatutory: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', EmployeeSchema);
