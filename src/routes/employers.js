// src/routes/employers.js
const express = require('express');
const router = express.Router();

const Employer = require('../models/Employer');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

/**
 * Helper: ensure current user is an employer (or admin).
 */
function assertEmployerOrAdmin(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  if (req.user.role !== 'employer' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Employer or admin role required' });
    return false;
  }
  return true;
}

/**
 * Resolve employerId for “me”
 * - If employer user: use req.user.employer
 * - If admin & query.employerId is provided: use that
 */
function resolveEmployerId(req) {
  if (!req.user) return null;

  if (req.user.role === 'employer' && req.user.employer) {
    return req.user.employer;
  }

  if (req.user.role === 'admin' && req.query && req.query.employerId) {
    return req.query.employerId;
  }

  return null;
}

/**
 * GET /api/employers/me
 * Return the employer profile for the current employer.
 */
router.get('/me', requireAuth, async (req, res) => {
  if (!assertEmployerOrAdmin(req, res)) return;

  const employerId = resolveEmployerId(req);
  if (!employerId) {
    return res.status(400).json({
      error:
        'No employer associated with this account. Ask support to link your employer profile.',
    });
  }

  try {
    const employer = await Employer.findById(employerId).lean();
    if (!employer) {
      return res
        .status(404)
        .json({ error: 'Employer profile not found for this account' });
    }

    res.json({
      id: employer._id,
      companyName: employer.companyName,
      legalName: employer.legalName,
      ein: employer.ein,
      contactName: employer.contactName,
      contactEmail: employer.contactEmail,
      phone: employer.phone,
      addressLine1: employer.addressLine1,
      addressLine2: employer.addressLine2,
      city: employer.city,
      state: employer.state,
      zip: employer.zip,
      createdAt: employer.createdAt,
      updatedAt: employer.updatedAt,
    });
  } catch (err) {
    console.error('GET /api/employers/me error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/employees
 * List employees for this employer.
 */
router.get('/me/employees', requireAuth, async (req, res) => {
  if (!assertEmployerOrAdmin(req, res)) return;

  const employerId = resolveEmployerId(req);
  if (!employerId) {
    return res.status(400).json({
      error:
        'No employer associated with this account. Ask support to link your employer profile.',
    });
  }

  try {
    const employees = await Employee.find({ employer: employerId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      employees.map((emp) => ({
        _id: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        externalEmployeeId: emp.externalEmployeeId || '',
        status: emp.status || 'active',
        createdAt: emp.createdAt,
      }))
    );
  } catch (err) {
    console.error('GET /api/employers/me/employees error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/payroll-runs
 * Recent payroll runs for this employer.
 */
router.get('/me/payroll-runs', requireAuth, async (req, res) => {
  if (!assertEmployerOrAdmin(req, res)) return;

  const employerId = resolveEmployerId(req);
  if (!employerId) {
    return res.status(400).json({
      error:
        'No employer associated with this account. Ask support to link your employer profile.',
    });
  }

  try {
    const runs = await PayrollRun.find({ employer: employerId })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json(
      runs.map((run) => ({
        _id: run._id,
        label: run.label || '',
        payDate: run.payDate,
        createdAt: run.createdAt,
        status: run.status || 'Completed',
        grossPay: run.grossPay,
        netPay: run.netPay,
        totalTaxes: run.totalTaxes,
        employee: run.employee
          ? {
              _id: run.employee._id,
              firstName: run.employee.firstName,
              lastName: run.employee.lastName,
              externalEmployeeId: run.employee.externalEmployeeId || '',
            }
          : null,
      }))
    );
  } catch (err) {
    console.error('GET /api/employers/me/payroll-runs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/paystubs
 * Latest paystubs across employees for this employer.
 * We go through PayrollRun so we can filter by employer.
 */
router.get('/me/paystubs', requireAuth, async (req, res) => {
  if (!assertEmployerOrAdmin(req, res)) return;

  const employerId = resolveEmployerId(req);
  if (!employerId) {
    return res.status(400).json({
      error:
        'No employer associated with this account. Ask support to link your employer profile.',
    });
  }

  try {
    // Find payroll runs for this employer first
    const runs = await PayrollRun.find({ employer: employerId })
      .select('_id employee payDate netPay')
      .sort({ payDate: -1 })
      .limit(200)
      .lean();

    const runIds = runs.map((r) => r._id);
    if (!runIds.length) {
      return res.json([]);
    }

    const paystubs = await Paystub.find({ payrollRun: { $in: runIds } })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .limit(200)
      .lean();

    res.json(
      paystubs.map((ps) => ({
        _id: ps._id,
        payDate: ps.payDate,
        fileName: ps.fileName,
        netPay: ps.netPay || null, // in case you later store per-stub net separately
        ytdGross: ps.ytdGross || 0,
        ytdNet: ps.ytdNet || 0,
        ytdTotalTaxes: ps.ytdTotalTaxes || 0,
        employee: ps.employee
          ? {
              _id: ps.employee._id,
              firstName: ps.employee.firstName,
              lastName: ps.employee.lastName,
              externalEmployeeId: ps.employee.externalEmployeeId || '',
            }
          : null,
      }))
    );
  } catch (err) {
    console.error('GET /api/employers/me/paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
