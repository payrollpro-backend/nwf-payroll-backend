// server.js (or index.js)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const Employee = require('./models/Employee');

// ⬇️ ROUTE IMPORTS (ONE paystubs import only)
const authRoutes = require('./routes/auth');
const employerRoutes = require('./routes/employers');
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
app.use('/api/employers', employerRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/paystubs', paystubRoutes); // <-- mounted once

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

    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
