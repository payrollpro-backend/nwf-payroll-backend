require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const verifyRoutes = require('./routes/verify');
const Employee = require('./models/Employee');

// ⬇️ ROUTE IMPORTS
const authRoutes = require('./routes/auth');
const employerRoutes = require('./routes/employers');       
const employersMeRoutes = require('./routes/employersMe');  
const employeeRoutes = require('./routes/employees');
const employeesMeRoutes = require('./routes/employeesMe'); 
const payrollRoutes = require('./routes/payroll');
const paystubRoutes = require('./routes/paystubs');
const adminRoutes = require('./routes/admin');
const taxformsRoutes = require('./routes/taxforms'); 
const applicationsRoutes = require('./routes/applications'); 

const app = express();

// ---------- CORS ----------
const allowedOrigins = [
  'https://www.nwfpayroll.com',
  'https://nwfpayroll.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    console.warn('Blocked CORS origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(morgan('dev'));


// ---------- ROOT ----------
app.get('/', (req, res) => {
  res.json({
    message: process.env.APP_NAME || 'NWF Payroll Backend',
  });
});


// ---------- HEALTH CHECK (✅ FIX) ----------
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(200).json({
    ok: true,
    service: 'nwf-payroll-backend',
    db: {
      readyState: dbState,
      connected: dbState === 1
    }
  });
});


// ---------- ROUTES ----------
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// EMPLOYER ROUTES
app.use('/api/employers', employersMeRoutes);    
app.use('/api/employers', employerRoutes);       

// EMPLOYEE ROUTES
app.use('/api/employees/me', employeesMeRoutes); 
app.use('/api/employees', employeeRoutes);       

// PAYROLL & VERIFICATION
app.use('/api/payroll', payrollRoutes);
app.use('/api/paystubs', paystubRoutes);
app.use('/api/verify-paystub', verifyRoutes);

// TAX FORMS
app.use('/api/taxforms', taxformsRoutes);

// JOB APPLICATIONS
app.use('/api/applications', applicationsRoutes);


// ---------- DEFAULT ADMIN SEED ----------
async function ensureDefaultAdmin() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@nwfpayroll.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'StrongPass123!';

  const existing = await Employee.findOne({ email });
  if (existing) {
    if (!existing.externalEmployeeId) {
      existing.externalEmployeeId = 'ADMIN-001';
      await existing.save();
    }
    console.log('✅ Default admin checked:', email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await Employee.create({
    firstName: 'NWF',
    lastName: 'Admin',
    email,
    passwordHash,
    role: 'admin',
    externalEmployeeId: 'ADMIN-001'
  });
  console.log('✅ Created default admin:', email);
}


// ---------- DEFAULT EMPLOYER SEED ----------
async function ensureDefaultEmployer() {
  const email = process.env.DEFAULT_EMPLOYER_EMAIL || 'agedcorps247@gmail.com';
  const defaultPassword = process.env.DEFAULT_EMPLOYER_PASSWORD || 'EmployerPass123!';

  let employer = await Employee.findOne({ email });

  if (!employer) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    employer = await Employee.create({
      firstName: 'NWF',
      lastName: 'Employer',
      email,
      passwordHash,
      role: 'employer',
      externalEmployeeId: 'EMPLOYER-001'
    });
    console.log('✅ Created default employer:', email);
    return;
  }

  let changed = false;
  if (employer.role !== 'employer') {
    employer.role = 'employer';
    changed = true;
  }
  if (!employer.externalEmployeeId) {
    employer.externalEmployeeId = 'EMPLOYER-001';
    changed = true;
  }

  if (changed) {
    await employer.save();
    console.log('✅ Updated default employer role/ID');
  }
}


// ---------- DB + SERVER ----------
const mongoUri = process.env.MONGO_URI;
const PORT = process.env.PORT || 10000;

if (!mongoUri) {
  console.error('❌ MONGO_URI is not set');
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    try {
      await ensureDefaultAdmin();
      await ensureDefaultEmployer();
    } catch (err) {
      console.error('⚠️ Seeder warning (ignored):', err.message);
    }

    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
