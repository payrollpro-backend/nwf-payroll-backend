const EmployeeSchema = new mongoose.Schema({
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', default: null },

  firstName: String,
  lastName: String,
  email: String,
  phone: String,

  // Auto-generated external ID like "Emp ID 01002"
  externalEmployeeId: { type: String, unique: true },

  // Onboarding data
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    zip: String,
  },
  dateOfBirth: Date,
  ssnLast4: String,          // only last 4, do NOT store full SSN in plain text
  payMethod: {
    type: String,
    enum: ['direct_deposit', 'paper_check'],
    default: 'direct_deposit',
  },
  directDeposit: {
    bankName: String,
    routingLast4: String,
    accountLast4: String,
    accountType: { type: String, enum: ['checking', 'savings'], default: 'checking' },
  },

  companyName: String,
  hourlyRate: { type: Number, default: 0 },

  // Withholding percentages (per pay period)
  federalWithholdingRate: { type: Number, default: 0.18 }, // 18% default
  stateWithholdingRate:   { type: Number, default: 0.05 }, // 5% GA default

  role: { type: String, enum: ['employee'], default: 'employee' },
  passwordHash: String,
}, { timestamps: true });
