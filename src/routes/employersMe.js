// src/routes/employersMe.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Employer = require('../models/Employer');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

const router = express.Router();

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
 * Return the employer record (like ADP company profile).
 */
router.get('/me', requireAuth(['employer']), async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    let employer = await Employer.findById(employerId).lean();

    // Fallback: if no Employer doc, return a minimal structure
    if (!employer) {
      return res.json({
        _id: employerId,
        companyName: 'N/A',
        contactEmail: req.user.email || '',
        contactName: 'N/A',
      });
    }

    res.json(employer);
  } catch (err) {
    console.error('/api/employers/me error:', err);
    res.status(500).json({ error: 'Failed to load employer profile' });
  }
});

/**
 * GET /api/employers/me/employees
 * List employees for this employer.
 */
router.get('/me/employees', requireAuth(['employer']), async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    const employees = await Employee.find({ employer: employerId })
      .select('firstName lastName email externalEmployeeId createdAt')
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
 * Recent payroll runs for this employer (like ADP run history).
 */
router.get('/me/payroll-runs', requireAuth(['employer']), async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    const runs = await PayrollRun.find({ employer: employerId })
      .sort({ payDate: -1 })
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
 * Great for a "Recent Activity" widget.
 */
router.get('/me/paystubs', requireAuth(['employer']), async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);

    // Find employees first
    const employees = await Employee.find({ employer: employerId })
      .select('_id firstName lastName externalEmployeeId')
      .lean();

    if (!employees.length) {
      return res.json([]);
    }

    const employeeIds = employees.map((e) => e._id);

    const paystubs = await Paystub.find({ employee: { $in: employeeIds } })
      .sort({ payDate: -1 })
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
