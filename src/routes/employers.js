// src/routes/employers.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Use env secret if set, otherwise a dev fallback
const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

/**
 * Sign a JWT for an employer user
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      // for employers, employerId is themselves
      employerId: user._id.toString(),
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

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

/**
 * PUBLIC: POST /api/employers/self-register
 *
 * Create an employer "account" that lives in the Employee collection
 * with role: 'employer'. This lets someone sign up as an employer
 * from the public registration form.
 *
 * Body:
 *  - companyName (required)
 *  - contactName (required)
 *  - email (required, unique)
 *  - password (required)
 *  - addressLine1, city, state, zip, phone (optional)
 *
 * Response:
 *  { token, user, employer }
 */
router.post('/self-register', async (req, res) => {
  try {
    const {
      companyName,
      contactName,
      email,
      password,
      addressLine1,
      city,
      state,
      zip,
      phone,
    } = req.body || {};

    if (!companyName || !contactName || !email || !password) {
      return res
        .status(400)
        .json({ error: 'companyName, contactName, email, and password are required' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'An account already exists for this email' });
    }

    // Basic split of "First Last"
    const parts = contactName.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const passwordHash = await bcrypt.hash(password, 10);

    // Create employer user (stored in Employee collection)
    const employerUser = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'employer',
      companyName,
      phone: phone || '',
      address: {
        line1: addressLine1 || '',
        line2: '',
        city: city || '',
        state: state || '',
        zip: zip || '',
      },
    });

    const token = signToken(employerUser);

    const userPayload = {
      id: employerUser._id,
      firstName: employerUser.firstName,
      lastName: employerUser.lastName,
      email: employerUser.email,
      role: employerUser.role,
      employerId: employerUser._id, // important for front-end
      companyName: employerUser.companyName || '',
    };

    const employerPayload = {
      id: employerUser._id,
      companyName: employerUser.companyName || '',
      contactName: `${employerUser.firstName || ''} ${employerUser.lastName || ''}`.trim(),
      contactEmail: employerUser.email,
      addressLine1: employerUser.address?.line1 || '',
      city: employerUser.address?.city || '',
      state: employerUser.address?.state || '',
      zip: employerUser.address?.zip || '',
      phone: employerUser.phone || '',
    };

    return res.status(201).json({
      token,
      user: userPayload,
      employer: employerPayload,
    });
  } catch (err) {
    console.error('POST /api/employers/self-register error:', err);
    res.status(500).json({ error: err.message || 'Employer registration failed' });
  }
});

// 🔒 Everything below this line requires auth
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
