require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Employee = require('./models/Employee');


const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ROUTES
const authRoutes = require('./routes/auth');
const employerRoutes = require('./routes/employers');  // ⬅️ NEW
const employeeRoutes = require('./routes/employees');
const payrollRoutes = require('./routes/payroll');
const paystubRoutes = require('./routes/paystubs');

app.get('/', (req, res) => {
  res.json({
    message: process.env.APP_NAME || 'NWF Payroll Backend is running',
  });
});

// MOUNT ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/employers', employerRoutes);  // ⬅️ NEW (employer signup portal)
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/paystubs', paystubRoutes);

// DB + SERVER START
const mongoUri = process.env.MONGO_URI;

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
