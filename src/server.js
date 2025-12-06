// src/server.js
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
const payrollRoutes = require('./routes/payroll');
const paystubRoutes = require('./routes/paystubs');         
const adminRoutes = require('./routes/admin');              


const app = express();

// ---------- CORS (FIXED) ----------
const allowedOrigins = [
  'https://www.nwfpayroll.com',  // WWW version
  'https://nwfpayroll.com',      // 👈 ADDED: Non-WWW version
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow tools with no origin (Postman, curl, mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn('Blocked CORS origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Preflight
app.options('*', cors());

app.use(express.json());
app.use(morgan('dev'));

// ---------- ROOT HEALTHCHECK ----------
app.get('/', (req, res) => {
  res.json({
    message: process.env.APP_NAME || 'NWF Payroll Backend is running',
  });
});

// ---------- ROUTES ----------

// Auth
app.use('/api/auth', authRoutes);

// Admin-only routes
app.use('/api/admin', adminRoutes);

// Employer routes
app.use('/api/employers', employerRoutes);      
app.use('/api/employers', employersMeRoutes);   

// Employee self-service routes
app.use('/api/employees', employeeRoutes);

// Payroll engine
app.use('/api/payroll', payrollRoutes);

// Paystubs
app.use('/api/paystubs', paystubRoutes);

// Public paystub verification
app.use('/api/verify-paystub', verifyRoutes);

// ---------- DEFAULT ADMIN SEEDER ----------
async function ensureDefaultAdmin() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@nwfpayroll.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'StrongPass123!';

  const existing = await Employee.findOne({ email, role: 'admin' });
  if (existing) {
    console.log('✅ Default admin already exists:', email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await Employee.create({
    firstName: 'NWF',
    lastName: 'Admin',
    email,
    passwordHash,
    role: 'admin',
  });

  console.log('✅ Created default admin:', email, 'password:', password);
}

// ---------- DEFAULT EMPLOYER SEEDER ----------
async function ensureDefaultEmployer() {
  const email = process.env.DEFAULT_EMPLOYER_EMAIL || 'agedcorps247@gmail.com';
  const defaultPassword =
    process.env.DEFAULT_EMPLOYER_PASSWORD || 'EmployerPass123!';

  let employer = await Employee.findOne({ email });

  if (!employer) {
    // Create a brand-new employer user
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    employer = await Employee.create({
      firstName: 'NWF',
      lastName: 'Employer',
      email,
      passwordHash,
      role: 'employer',
    });

    console.log(
      '✅ Created default employer:',
      email,
      'password:',
      defaultPassword
    );
    return;
  }

  // If it already exists, force role=employer and reset password
  employer.role = 'employer';
  employer.passwordHash = await bcrypt.hash(defaultPassword, 10);
  await employer.save();

  console.log(
    '✅ Default employer existed; role set to employer and password reset for:',
    email,
    'password:',
    defaultPassword
  );
}

// ---------- DB + SERVER START ----------
const mongoUri = process.env.MONGO_URI;
const PORT = process.env.PORT || 10000;

if (!mongoUri) {
  console.error('❌ MONGO_URI is not set in environment variables');
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    await ensureDefaultAdmin();
    await ensureDefaultEmployer();

    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
