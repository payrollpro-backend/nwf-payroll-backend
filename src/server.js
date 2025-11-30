require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const verifyRoutes = require('./routes/verify');

const Employee = require('./models/Employee');

// ⬇️ ROUTE IMPORTS (ONE paystubs import only)
const authRoutes = require('./routes/auth');
const employerRoutes = require('./routes/employers');       // existing employer routes
const employersMeRoutes = require('./routes/employersMe');  // NEW: /me, /me/employees, etc.
const employeeRoutes = require('./routes/employees');
const payrollRoutes = require('./routes/payroll');
const paystubRoutes = require('./routes/paystubs'); // <-- use THIS one, single source

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ROOT HEALTHCHECK
app.get('/', (req, res) => {
  res.json({
    message: process.env.APP_NAME || 'NWF Payroll Backend is running',
  });
});

// MOUNT ROUTES
app.use('/api/auth', authRoutes);

// Both routers share the same /api/employers base path
app.use('/api/employers', employerRoutes);      // your existing employer routes
app.use('/api/employers', employersMeRoutes);   // new /me, /me/employees, /me/payroll-runs, /me/paystubs

app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/paystubs', paystubRoutes); // <-- mounted once
app.use('/api/verify-paystub', verifyRoutes);

// === DEFAULT ADMIN SEEDER ===
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

// === DEFAULT EMPLOYER SEEDER ===
async function ensureDefaultEmployer() {
  const email = process.env.DEFAULT_EMPLOYER_EMAIL || 'agedcorps247@gmail.com';
  const defaultPassword = process.env.DEFAULT_EMPLOYER_PASSWORD || 'EmployerPass123!';

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

    console.log('✅ Created default employer:', email, 'password:', defaultPassword);
    return;
  }

  // If it already exists, just make sure role is employer.
  employer.role = 'employer';

  // If it has no password set yet, give it the default.
  if (!employer.passwordHash) {
    employer.passwordHash = await bcrypt.hash(defaultPassword, 10);
    console.log('✅ Default employer existed; set password for:', email, 'password:', defaultPassword);
  } else {
    console.log('✅ Default employer existed; role set to employer:', email);
  }

  await employer.save();
}

// DB + SERVER START
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
    await ensureDefaultEmployer();   // 👈 Make sure your employer user exists / is set

    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
