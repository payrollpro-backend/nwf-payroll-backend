// routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { sendWelcomeEmail } = require('../utils/email');
const { getTaxDefaultsForState } = require('../utils/taxConfig');

const router = express.Router();

/**
 * Generate a temporary password for the employee portal
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
 * Generate external Employee ID like:
 *   Emp_ID_938203948
 * We ensure uniqueness by checking the DB.
 */
async function generateExternalEmployeeId() {
  let externalId;
  let exists = true;

  while (exists) {
    const rand = Math.floor(100000000 + Math.random() * 900000000); // 9-digit
    externalId = `Emp_ID_${rand}`;
    // Ensure it's unique
    // Adjust field name if your schema uses something else
    exists = await Employee.exists({ externalEmployeeId: externalId });
  }

  return externalId;
}

/**
 * Create employee
 * Used by your NWF admin or (later) Employer portal.
 */
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,

      // Company / employer info
      companyName,
      hourlyRate,

      // Address + onboarding
      address,            // { line1, line2, city, state, zip }
      dateOfBirth,
      ssnLast4,
      payMethod,          // 'direct_deposit' | 'paper_check'
      directDeposit,      // { bankName, routingLast4, accountLast4, accountType }

      // Optional overrides for tax rates
      federalWithholdingRate,
      stateWithholdingRate,
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

    // Auto tax defaults from employee state (e.g. FL => 0 state tax)
    const defaults = getTaxDefaultsForState(address?.state);
    const fedRate = federalWithholdingRate ?? defaults.federalRate;
    const stRate = stateWithholdingRate ?? defaults.stateRate;

    // Temp password for employee login
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // External Employee ID, like Emp_ID_938203948
    const externalEmployeeId = await generateExternalEmployeeId();

    const employee = await Employee.create({
      firstName,
      lastName,
      email,
      phone,

      address,
      dateOfBirth,
      ssnLast4,
      payMethod,
      directDeposit,

      companyName: companyName || 'NWF Payroll Client',
      hourlyRate: hourlyRate || 0,

      federalWithholdingRate: fedRate,
      stateWithholdingRate: stRate,

      externalEmployeeId,   // make sure this field exists in your Employee schema
      role: 'employee',
      passwordHash,
    });

    // Optional welcome email
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
    console.error('Create employee error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * List employees (for the admin dashboard)
 */
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
