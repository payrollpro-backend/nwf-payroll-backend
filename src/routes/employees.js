// src/routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

const router = express.Router();

/**
 * Generate a random temp password so we can set passwordHash
 * (employees don't have to log in yet, but the schema expects a hash).
 */
function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * External Employee ID format:
 *   Emp_ID_938203948
 */
function generateExternalEmployeeId() {
  const num = Math.floor(100000000 + Math.random() * 900000000); // 9 digits
  return `Emp_ID_${num}`;
}

/**
 * POST /api/employees
 * Create a new employee (used by admin create-employee.html)
 */
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      companyName,
      hourlyRate,
      address = {},
      dob,
      ssnLast4,
      payMethod,
      directDeposit = {},
    } = req.body || {};

    if (!firstName || !lastName || !email || !companyName) {
      return res.status(400).json({
        error: 'firstName, lastName, email, and companyName are required',
      });
    }

    if (!hourlyRate || isNaN(hourlyRate)) {
      return res.status(400).json({
        error: 'hourlyRate must be a valid number',
      });
    }

    // Basic uniqueness check on email
    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'An employee with this email already exists' });
    }

    // Create password hash (even if employees never log in directly yet)
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const externalEmployeeId = generateExternalEmployeeId();

    const employee = await Employee.create({
      firstName,
      lastName,
      email,
      companyName,
      hourlyRate,
      role: 'employee',
      externalEmployeeId,

      address: {
        line1: address.line1 || '',
        line2: address.line2 || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.zip || '',
      },

      dob: dob || null,
      ssnLast4: ssnLast4 || '',

      payMethod: payMethod || 'direct_deposit',
      directDeposit: {
        bankName: directDeposit.bankName || '',
        accountType: directDeposit.accountType || '',
        routingNumber: directDeposit.routingNumber || '',
        accountNumber: directDeposit.accountNumber || '',
      },

      passwordHash,
    });

    // Do NOT send password or passwordHash back
    const safe = employee.toObject();
    delete safe.passwordHash;

    res.status(201).json(safe);
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: err.message || 'Failed to create employee' });
  }
});

/**
 * GET /api/employees
 * Return all employees (for admin pages, run-payroll, etc.)
 */
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 }).lean();
    res.json(employees);
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ error: err.message || 'Failed to load employees' });
  }
});

module.exports = router;
