// src/routes/employersMe.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

const router = express.Router();

/**
 * All /api/employers/me* routes require an authenticated employer OR admin.
 */
router.use(requireAuth(['employer', 'admin']));

/**
 * Helper: figure out which employer id to use.
 * - If JWT has employerId, use that.
 * - Otherwise fall back to the user id itself.
 */
function getEmployerIdFromUser(payload) {
  if (payload.employerId) return payload.employerId;
  return payload.id;
}

/**
 * GET /api/employers/me
 * Return an employer profile structure.
 */
router.get('/me', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    const employerUser = await Employee.findById(employerId).lean();

    // If we don't find a matching Employee doc, still return a minimal structure
    if (!employerUser) {
      return res.json({
        id: employerId,
        companyName: 'Your Company',
        contactEmail: req.user.email || '',
        contactName: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zip: '',
      });
    }

    const addr = employerUser.address || {};

    res.json({
      id: employerUser._id,
      companyName: employerUser.companyName || '',
      contactEmail: employerUser.email || '',
      contactName:
        `${employerUser.firstName || ''} ${employerUser.lastName || ''}`.trim(),
      addressLine1: addr.line1 || '',
      addressLine2: addr.line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zip || '',
    });
  } catch (err) {
    console.error('/api/employers/me error:', err);
    res.status(500).json({ error: 'Failed to load employer profile' });
  }
});

/**
 * GET /api/employers/me/employees
 * List employees for this employer.
 */
router.get('/me/employees', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    const employees = await Employee.find({
      employer: employerId,
      role: 'employee',
    })
      .select(
        'firstName lastName email externalEmployeeId payType payFrequency filingStatus createdAt status'
      )
      .sort({ createdAt: -1 })
      .lean();

    res.json(employees);
  } catch (err) {
    console.error('/api/employers/me/employees error:', err);
    res.status(500).json({ error: 'Failed to load employees' });
  }
});

/**
 * GET /api/employers/me/payroll-runs
 * Recent payroll runs for this employer.
 */
router.get('/me/payroll-runs', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    const runs = await PayrollRun.find({ employer: employerId })
      .sort({ payDate: -1, createdAt: -1 })
      .limit(20)
      .lean();

    res.json(runs);
  } catch (err) {
    console.error('/api/employers/me/payroll-runs error:', err);
    res.status(500).json({ error: 'Failed to load payroll runs' });
  }
});

/**
 * GET /api/employers/me/paystubs
 * Recent paystubs across all employees for this employer.
 */
router.get('/me/paystubs', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    // 1) Find employees for this employer
    const employees = await Employee.find({
      employer: employerId,
      role: 'employee',
    })
      .select('_id firstName lastName externalEmployeeId email')
      .lean();

    if (!employees.length) {
      return res.json([]);
    }

    const employeeIds = employees.map((e) => e._id);

    // 2) Find paystubs for those employees
    const paystubs = await Paystub.find({
      employee: { $in: employeeIds },
    })
      .sort({ payDate: -1, createdAt: -1 })
      .limit(50)
      .populate('employee', 'firstName lastName externalEmployeeId email')
      .lean();

    res.json(paystubs);
  } catch (err) {
    console.error('/api/employers/me/paystubs error:', err);
    res.status(500).json({ error: 'Failed to load paystubs' });
  }
});

module.exports = router;
