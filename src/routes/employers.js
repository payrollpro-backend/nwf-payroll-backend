// src/routes/employers.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Same secret as auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

/**
 * Sign a JWT for an employer user
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
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

// src/routes/employers.js

// ... keep your existing imports and setup at the top ...

/**
 * PUBLIC: POST /api/employers/register
 * Employer self-signup
 */
router.post('/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      companyName,
      phone,
      ein,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
    } = req.body || {};

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error: 'firstName, lastName, email, and password are required',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    // ⬇️ NEW: Generate a unique ID so it doesn't clash with the default employer
    const externalEmployeeId = generateExternalEmployeeId(); 

    // Create the employer as a special Employee record with role="employer"
    const employer = await Employee.create({
      role: 'employer',
      
      // ⬇️ NEW: Save the generated ID
      externalEmployeeId, 

      firstName,
      lastName,
      email,
      phone: phone || '',

      companyName: companyName || '',
      ein: ein || '',

      address: {
        line1: addressLine1 || '',
        line2: addressLine2 || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
      },

      payType: 'hourly',
      hourlyRate: 0,
      salaryAmount: 0,
      payFrequency: 'biweekly',
      federalWithholdingRate: 0,
      stateWithholdingRate: 0,

      passwordHash,
    });

    const token = signToken(employer);

    return res.status(201).json({
      token,
      user: {
        id: employer._id,
        firstName: employer.firstName,
        lastName: employer.lastName,
        email: employer.email,
        role: employer.role,
        employerId: employer._id,
      },
    });
  } catch (err) {
    console.error('POST /api/employers/register error:', err);
    
    // Friendly error for duplicates
    if (err.code === 11000) {
        return res.status(400).json({ error: 'This email or ID is already registered.' });
    }

    res.status(500).json({ error: err.message || 'Employer registration failed' });
  }
});
// ⬇️ Everything below this line REQUIRES auth (employer or admin)
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
    const tempPassword = Math.random().toString(36).slice(2, 8) + '!Aa1';
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
