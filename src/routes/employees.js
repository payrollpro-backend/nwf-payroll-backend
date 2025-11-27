const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
// REMOVE auth middleware import
// const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../utils/email');

const router = express.Router();

function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// Create employee — OPEN (no auth needed)
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      hourlyRate,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res
        .status(400)
        .json({ error: 'firstName, lastName and email are required.' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const employee = await Employee.create({
      firstName,
      lastName,
      email,
      phone,
      companyName: companyName || 'NWF Payroll Client',
      hourlyRate: hourlyRate || 0,
      role: 'employee',
      passwordHash,
    });

    // OPTIONAL — you can comment this out if not using email
    try {
      await sendWelcomeEmail(employee.email, tempPassword);
    } catch (emailErr) {
      console.error('Error sending welcome email:', emailErr.message);
    }

    res.status(201).json({
      employee,
      tempPassword,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List employees — OPEN (no auth needed)
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
