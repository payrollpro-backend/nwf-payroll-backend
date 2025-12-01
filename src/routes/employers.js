// src/routes/employers.js
const express = require('express');
const bcrypt = require('bcryptjs');

const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: make sure the current user is an employer (or admin).
 */
function ensureEmployer(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (req.user.role !== 'employer' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Employer access required' });
    return null;
  }
  return req.user;
}

/**
 * Helper: generate a display employee ID like EMP_XXXXXXX
 */
function generateExternalEmployeeId() {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `EMP_${rand}`;
}

// All routes in here require auth
router.use(requireAuth);

/**
 * GET /api/employers/me
 * Return employer profile info (based on the logged-in user document).
 */
router.get('/me', async (req, res) => {
  const employerUser = ensureEmployer(req, res);
  if (!employerUser) return;

  const addr = employerUser.address || {};

  res.json({
    id: employerUser._id,
    companyName: employerUser.companyName || '',
    contactEmail: employerUser.email || '',
    contactName: `${employerUser.firstName || ''} ${employerUser.lastName || ''}`.trim(),
    addressLine1: addr.line1 || '',
    addressLine2: addr.line2 || '',
    city: addr.city || '',
    state: addr.state || '',
    zip: addr.zip || '',
  });
});

/**
 * GET /api/employers/me/employees
 * List employees that belong to this employer.
 */
router.get('/me/employees', async (req, res) => {
  const employerUser = ensureEmployer(req, res);
  if (!employerUser) return;

  const employerId = employerUser._id;

  try {
    const employees = await Employee.find({
      employer: employerId,
      role: 'employee',
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(employees);
  } catch (err) {
    console.error('GET /me/employees error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/employers/me/employees
 * Create a new employee under this employer.
 * This is the route your frontend is calling.
 */
router.post('/me/employees', async (req, res) => {
  const employerUser = ensureEmployer(req, res);
  if (!employerUser) return;

  const employerId = employerUser._id;
  const {
    firstName,
    lastName,
    email,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
    payType,
    hourlyRate,
    salaryAmount,
    payFrequency,
    federalWithholdingRate,
    stateWithholdingRate,
  } = req.body || {};

  if (!firstName || !lastName || !email) {
    return res.status(400).json({
      error: 'firstName, lastName, and email are required',
    });
  }

  try {
    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const externalEmployeeId = generateExternalEmployeeId();

    // Temporary password for the employee (can be shown to employer)
    const tempPassword =
      Math.random().toString(36).slice(2, 8) + '!Aa1';
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const employee = await Employee.create({
      employer: employerId,
      role: 'employee',

      firstName,
      lastName,
      email,
      phone: phone || '',

      externalEmployeeId,

      address: {
        line1: addressLine1 || '',
        line2: addressLine2 || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
      },

      payType: payType || 'hourly',
      hourlyRate: typeof hourlyRate === 'number' ? hourlyRate : 0,
      salaryAmount: typeof salaryAmount === 'number' ? salaryAmount : 0,
      payFrequency: payFrequency || 'biweekly',

      federalWithholdingRate:
        typeof federalWithholdingRate === 'number'
          ? federalWithholdingRate
          : 0,
      stateWithholdingRate:
        typeof stateWithholdingRate === 'number'
          ? stateWithholdingRate
          : 0,

      passwordHash,
    });

    res.status(201).json({
      employee,
      tempPassword,
    });
  } catch (err) {
    console.error('POST /me/employees error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/payroll-runs
 * All payroll runs for employees belonging to this employer.
 */
router.get('/me/payroll-runs', async (req, res) => {
  const employerUser = ensureEmployer(req, res);
  if (!employerUser) return;

  const employerId = employerUser._id;

  try {
    const runs = await PayrollRun.find({ employer: employerId })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .lean();

    res.json(runs);
  } catch (err) {
    console.error('GET /me/payroll-runs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/paystubs
 * Paystubs for employees belonging to this employer.
 */
router.get('/me/paystubs', async (req, res) => {
  const employerUser = ensureEmployer(req, res);
  if (!employerUser) return;

  const employerId = employerUser._id;

  try {
    // 1) find employees of this employer
    const employees = await Employee.find({
      employer: employerId,
      role: 'employee',
    })
      .select('_id')
      .lean();

    const employeeIds = employees.map((e) => e._id);

    if (!employeeIds.length) {
      return res.json([]);
    }

    // 2) find paystubs for those employees
    const paystubs = await Paystub.find({
      employee: { $in: employeeIds },
    })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .lean();

    res.json(paystubs);
  } catch (err) {
    console.error('GET /me/paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
