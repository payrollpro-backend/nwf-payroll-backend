// src/models/PayrollRun.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PayrollRunSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    employer: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },

    payType: { type: String, enum: ['hourly', 'salary'], default: 'hourly' },
    payFrequency: { type: String, enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'], default: 'biweekly' },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    payDate: { type: Date, required: true },

    hoursWorked: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },

    // --- EMPLOYEE WITHHOLDINGS (Deducted from paycheck) ---
    grossPay: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    federalIncomeTax: { type: Number, default: 0 },
    stateIncomeTax: { type: Number, default: 0 },
    socialSecurity: { type: Number, default: 0 }, // 6.2%
    medicare: { type: Number, default: 0 },       // 1.45%
    totalTaxes: { type: Number, default: 0 },     // Total Employee Taxes

    // --- EMPLOYER TAXES (Company Cost - Not deducted from check) ---
    // Standard US Rates: SS Match (6.2%), Med Match (1.45%), FUTA (~0.6%)
    employerSocialSecurity: { type: Number, default: 0 }, 
    employerMedicare: { type: Number, default: 0 },       
    employerFUTA: { type: Number, default: 0 },           
    
    // Status of the Tax Payment
    // Options: 'Pending', 'Self-Filed', 'Requested-NWF', 'Completed'
    taxFilingStatus: { type: String, default: 'Pending' },

    // YTD snapshots
    ytdGross: { type: Number, default: 0 },
    ytdNet: { type: Number, default: 0 },
    ytdFederalIncomeTax: { type: Number, default: 0 },
    ytdStateIncomeTax: { type: Number, default: 0 },
    ytdSocialSecurity: { type: Number, default: 0 },
    ytdMedicare: { type: Number, default: 0 },
    ytdTotalTaxes: { type: Number, default: 0 },
    
    notes: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
