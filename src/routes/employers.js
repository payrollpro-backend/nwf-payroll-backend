// src/routes/employers.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Employer = require('../models/Employer');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');


// IMPORTANT: destructure requireAuth from the exported object
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Use same JWT secret + payload shape as auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      employerId: user.employer ? user.employer.toString() : null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/employers/register
 * Public endpoint to create a new Employer + employer login user.
 * Returns a token + user object so the frontend can log them in immediately.
 */
router.post('/register', async (req, res) => {
  try {
    const {
      // Company section
      companyName,
      ein,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,

      // Employer login user
      firstName,
      lastName,
      email,
      password,
    } = req.body || {};

    // Basic required fields
    if (!companyName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error: 'companyName, firstName, lastName, email and password are required',
      });
    }

    // Prevent duplicate login email
    const existingUser = await Employee.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: 'An account already exists with this email',
      });
    }

    // Create Employer record
    const employer = await Employer.create({
      companyName,
      ein: ein || '',
      phone: phone || '',
      addressLine1: addressLine1 || '',
      addressLine2: addressLine2 || '',
      city: city || '',
      state: state || '',
      zip: zip || '',
      contactName: `${firstName} ${lastName}`,
      contactEmail: email,
    });

    // Hash employer user password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create employer user in Employee collection
    const employerUser = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'employer',
      employer: employer._id,
      companyName: companyName,
      phone: phone || '',
      address: {
        line1: addressLine1 || '',
        line2: addressLine2 || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
      },
    });

    const token = signToken(employerUser);

    return res.status(201).json({
      token,
      user: {
        id: employerUser._id,
        firstName: employerUser.firstName,
        lastName: employerUser.lastName,
        email: employerUser.email,
        role: employerUser.role,
        employerId: employerUser.employer,
      },
      employer,
    });
  } catch (err) {
    console.error('employer register error:', err);
    res
      .status(500)
      .json({ error: err.message || 'Employer registration failed' });
  }
});

/**
 * GET /api/employers/me
 * Return the employer profile for the logged in employer user.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    // requireAuth should have decoded token → req.user
    const user = req.user;

    if (!user || user.role !== 'employer') {
      return res.status(403).json({ error: 'Employer access only' });
    }

    let employerId = user.employerId || null;

    let employer = null;
    if (employerId) {
      employer = await Employer.findById(employerId).lean();
    }

    // Fallback: try matching by contactEmail
    if (!employer) {
      employer = await Employer.findOne({ contactEmail: user.email }).lean();
    }

    if (!employer) {
      return res.status(404).json({ error: 'Employer profile not found' });
    }

    res.json(employer);
  } catch (err) {
    console.error('employer /me error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/employees
 * List employees that belong to this employer.
 */
router.get('/me/employees', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'employer') {
      return res.status(403).json({ error: 'Employer access only' });
    }

    const employerId = user.employerId;

    if (!employerId) {
      return res
        .status(400)
        .json({ error: 'Employer ID missing on token/user' });
    }

    const employees = await Employee.find({
      employer: employerId,
      role: 'employee',
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(employees);
  } catch (err) {
    console.error('employer /me/employees error:', err);
    res.status(500).json({ error: err.message });
  }
  // POST /api/employers/me/employees
// Create a new employee belonging to the logged-in employer
router.post('/me/employees', authEmployerOnly, async (req, res) => {
  try {
    const employerId = req.user.employerId;
    if (!employerId) {
      return res.status(400).json({ error: 'No employerId on this account' });
    }

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
      payFrequency,
      hourlyRate,
      salaryAmount,

      filingStatus,
      federalWithholdingRate,
      stateWithholdingRate,

      payMethod,
      bankName,
      accountType,
      routingNumber,
      accountNumberLast4,

      startDate,
      status,
    } = req.body || {};

    if (!firstName || !lastName || !email) {
      return res
        .status(400)
        .json({ error: 'firstName, lastName, and email are required' });
    }

    const fedRateVal = parseFloat(federalWithholdingRate ?? 0) || 0;
    const stateRateVal = parseFloat(stateWithholdingRate ?? 0) || 0;

    const employee = await Employee.create({
      employer: employerId,

      firstName,
      lastName,
      email,
      phone: phone || '',

      address: {
        line1: addressLine1 || '',
        line2: addressLine2 || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
      },

      payType: payType || 'hourly',
      payFrequency: payFrequency || 'biweekly',
      hourlyRate: Number(hourlyRate) || 0,
      salaryAmount: Number(salaryAmount) || 0,

      filingStatus: filingStatus || 'single',

      federalWithholdingRate: fedRateVal > 1 ? fedRateVal / 100 : fedRateVal,
      stateWithholdingRate: stateRateVal > 1 ? stateRateVal / 100 : stateRateVal,

      payMethod: payMethod || 'direct_deposit',
      directDeposit: {
        accountType: accountType || '',
        bankName: bankName || '',
        routingNumber: routingNumber || '',
        accountNumberLast4: accountNumberLast4 || '',
      },

      startDate: startDate ? new Date(startDate) : undefined,
      status: status || 'active',
      // externalEmployeeId will be auto-generated by the pre-save hook
    });

    res.status(201).json(employee);
  } catch (err) {
    console.error('employer create employee error:', err);
    res.status(400).json({ error: err.message });
  }
});

});

/**
 * GET /api/employers/me/payroll-runs
 * List payroll runs for this employer.
 */
router.get('/me/payroll-runs', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'employer') {
      return res.status(403).json({ error: 'Employer access only' });
    }

    const employerId = user.employerId;
    if (!employerId) {
      return res
        .status(400)
        .json({ error: 'Employer ID missing on token/user' });
    }

    const runs = await PayrollRun.find({ employer: employerId })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .lean();

    res.json(runs);
  } catch (err) {
    console.error('employer /me/payroll-runs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/paystubs
 * List paystubs for this employer.
 * Assumes Paystub has an `employer` field. If not, adjust to derive
 * via populated payrollRun.employer instead.
 */
router.get('/me/paystubs', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'employer') {
      return res.status(403).json({ error: 'Employer access only' });
    }

    const employerId = user.employerId;
    if (!employerId) {
      return res
        .status(400)
        .json({ error: 'Employer ID missing on token/user' });
    }

    const paystubs = await Paystub.find({ employer: employerId })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .lean();

    res.json(paystubs);
  } catch (err) {
    console.error('employer /me/paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
