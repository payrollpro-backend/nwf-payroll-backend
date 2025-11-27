const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { sendWelcomeEmail } = require('../utils/email'); // keep if you have it
const { getTaxDefaultsForState } = require('../utils/taxConfig');

const router = express.Router();

function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function generateExternalEmployeeId() {
  let externalId;
  let exists = true;

  while (exists) {
    const rand = Math.floor(100000000 + Math.random() * 900000000); // 9-digit
    externalId = `Emp_ID_${rand}`;
    exists = await Employee.exists({ externalEmployeeId: externalId });
  }
  return externalId;
}

// Create payroll employee
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      hourlyRate,
      address,
      dateOfBirth,
      ssnLast4,
      payMethod,
      directDeposit,
      federalWithholdingRate,
      stateWithholdingRate,
      employerId, // optional for future multi-tenant
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName and email are required.' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    const defaults = getTaxDefaultsForState(address?.state);
    const fedRate = federalWithholdingRate ?? defaults.federalRate;
    const stRate = stateWithholdingRate ?? defaults.stateRate;

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const externalEmployeeId = await generateExternalEmployeeId();

    const employee = await Employee.create({
      employer: employerId || null,
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
      externalEmployeeId,
      role: 'employee',
      passwordHash,
    });

    try {
      if (sendWelcomeEmail) {
        await sendWelcomeEmail(employee.email, tempPassword);
      }
    } catch (e) {
      console.error('sendWelcomeEmail error:', e.message);
    }

    res.status(201).json({ employee, tempPassword });
  } catch (err) {
    console.error('employee create error:', err);
    res.status(400).json({ error: err.message });
  }
});

// List employees
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find({ role: 'employee' }).sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
