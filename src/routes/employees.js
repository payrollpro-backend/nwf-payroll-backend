// src/routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');

const router = express.Router();

const Employee = require('../models/Employee');
const Employer = require('../models/Employer');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

/**
 * Utility: build a safe JSON view of an employee
 */
function serializeEmployee(emp) {
  return {
    _id: emp._id,
    employer: emp.employer,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    phone: emp.phone || '',
    role: emp.role,
    externalEmployeeId: emp.externalEmployeeId || '',
    companyName: emp.companyName || '',
    address: emp.address || {},
    payMethod: emp.payMethod,
    directDeposit: emp.directDeposit || {},
    payType: emp.payType,
    hourlyRate: emp.hourlyRate,
    salaryAmount: emp.salaryAmount,
    payFrequency: emp.payFrequency,
    hireDate: emp.hireDate,
    startDate: emp.startDate,
    status: emp.status,
    filingStatus: emp.filingStatus,
    federalWithholdingRate: emp.federalWithholdingRate,
    stateWithholdingRate: emp.stateWithholdingRate,
    federalAllowances: emp.federalAllowances,
    stateAllowances: emp.stateAllowances,
    extraFederalWithholding: emp.extraFederalWithholding,
    extraStateWithholding: emp.extraStateWithholding,
    stateCode: emp.stateCode || '',
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
  };
}

/* ------------------------------------------------------------------------ */
/* EMPLOYEE SELF-SERVICE ENDPOINTS (used by employee login + dashboard)     */
/* ------------------------------------------------------------------------ */

/**
 * GET /api/employees/me
 * Employee sees their own profile (used by employee-dashboard.html).
 */
router.get('/me', requireAuth(['employee']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.user.id);
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(serializeEmployee(emp));
  } catch (err) {
    console.error('GET /api/employees/me error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employees/me/paystubs
 * Employee sees ONLY their own paystubs.
 * Used by employee-dashboard.html for YTD + paystub table.
 */
router.get('/me/paystubs', requireAuth(['employee']), async (req, res) => {
  try {
    const empId = req.user.id;

    const paystubs = await Paystub.find({ employee: empId })
      .sort({ payDate: -1, createdAt: -1 })
      .lean();

    // We just return the raw docs; frontend already expects fields like:
    // ytdGross, ytdNet, ytdTotalTaxes, netPay, payDate, _id, etc.
    res.json(paystubs);
  } catch (err) {
    console.error('GET /api/employees/me/paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/employees/me
 * Employee can update their own profile, but ONLY:
 * - phone
 * - address (line1, line2, city, state, zip)
 * - payMethod
 * - directDeposit (accountType, bankName, routingNumber, accountNumberLast4)
 *
 * Things like hourlyRate / salary / filingStatus stay employer/admin-only.
 */
router.patch('/me', requireAuth(['employee']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.user.id);
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const b = req.body || {};

    if (b.phone !== undefined) {
      emp.phone = b.phone;
    }

    if (b.address) {
      emp.address = {
        line1: b.address.line1 || '',
        line2: b.address.line2 || '',
        city: b.address.city || '',
        state: b.address.state || '',
        zip: b.address.zip || '',
      };
    }

    if (b.payMethod !== undefined) {
      emp.payMethod = b.payMethod;
    }

    if (b.directDeposit) {
      emp.directDeposit = {
        accountType: b.directDeposit.accountType || '',
        bankName: b.directDeposit.bankName || '',
        routingNumber: b.directDeposit.routingNumber || '',
        accountNumberLast4: b.directDeposit.accountNumberLast4 || '',
      };
    }

    await emp.save();
    res.json({ employee: serializeEmployee(emp) });
  } catch (err) {
    console.error('PATCH /api/employees/me error:', err);
    res.status(400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------------ */
/* ADMIN ENDPOINTS                                                          */
/* ------------------------------------------------------------------------ */

/**
 * GET /api/employees
 * Admin only – list all employees
 */
router.get('/', requireAuth(['admin']), async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 }).lean();
    res.json(employees.map(serializeEmployee));
  } catch (err) {
    console.error('GET /api/employees error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employees/:id
 * Admin can view any; employees can ONLY view themselves.
 */
router.get('/:id', requireAuth(['admin', 'employee']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean();
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // If not admin, they must be this employee
    if (req.user.role !== 'admin' && req.user.id !== String(emp._id)) {
      return res
        .status(403)
        .json({ error: 'Not allowed to view this employee' });
    }

    res.json(serializeEmployee(emp));
  } catch (err) {
    console.error('GET /api/employees/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/employees
 * Admin-only create employee.
 * (Employer self-create employees is handled in /api/employers/me/employees.)
 */
router.post('/', requireAuth(['admin']), async (req, res) => {
  try {
    const {
      employerId,
      firstName,
      lastName,
      email,
      phone,
      companyName,
      address,
      payMethod,
      directDeposit,
      payType,
      hourlyRate,
      salaryAmount,
      payFrequency,
      hireDate,
      startDate,
      status,
      filingStatus,
      federalWithholdingRate,
      stateWithholdingRate,
      federalAllowances,
      stateAllowances,
      extraFederalWithholding,
      extraStateWithholding,
      stateCode,
    } = req.body || {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'firstName, lastName, email required',
      });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ error: 'Employee with this email already exists' });
    }

    let employer = null;
    if (employerId) {
      employer = await Employer.findById(employerId);
      if (!employer) {
        return res.status(400).json({ error: 'Invalid employerId' });
      }
    }

    // temp password for admin-created employees
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newEmp = await Employee.create({
      employer: employer ? employer._id : null,
      firstName,
      lastName,
      email,
      phone: phone || '',
      role: 'employee',
      externalEmployeeId: '', // can be set later or generated
      companyName: companyName || '',
      address: {
        line1: address?.line1 || '',
        line2: address?.line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        zip: address?.zip || '',
      },
      payMethod: payMethod || 'direct_deposit',
      directDeposit: {
        accountType: directDeposit?.accountType || '',
        bankName: directDeposit?.bankName || '',
        routingNumber: directDeposit?.routingNumber || '',
        accountNumberLast4: directDeposit?.accountNumberLast4 || '',
      },
      payType: payType || 'hourly',
      hourlyRate: typeof hourlyRate === 'number' ? hourlyRate : 0,
      salaryAmount: typeof salaryAmount === 'number' ? salaryAmount : 0,
      payFrequency: payFrequency || 'biweekly',
      hireDate: hireDate ? new Date(hireDate) : Date.now(),
      startDate: startDate ? new Date(startDate) : Date.now(),
      status: status || 'active',
      filingStatus: filingStatus || 'single',
      federalWithholdingRate:
        typeof federalWithholdingRate === 'number' ? federalWithholdingRate : 0,
      stateWithholdingRate:
        typeof stateWithholdingRate === 'number' ? stateWithholdingRate : 0,
      federalAllowances:
        typeof federalAllowances === 'number' ? federalAllowances : 0,
      stateAllowances:
        typeof stateAllowances === 'number' ? stateAllowances : 0,
      extraFederalWithholding:
        typeof extraFederalWithholding === 'number'
          ? extraFederalWithholding
          : 0,
      extraStateWithholding:
        typeof extraStateWithholding === 'number'
          ? extraStateWithholding
          : 0,
      stateCode: stateCode || '',
      passwordHash,
    });

    // You can email tempPassword here if needed

    res.status(201).json({ employee: serializeEmployee(newEmp) });
  } catch (err) {
    console.error('POST /api/employees error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/employees/:id
 * Admin-only update of any employee.
 */
router.patch('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const b = req.body || {};

    if (b.firstName !== undefined) emp.firstName = b.firstName;
    if (b.lastName !== undefined) emp.lastName = b.lastName;
    if (b.email !== undefined) emp.email = b.email;
    if (b.phone !== undefined) emp.phone = b.phone;
    if (b.companyName !== undefined) emp.companyName = b.companyName;

    if (b.address) {
      emp.address = {
        line1: b.address.line1 || '',
        line2: b.address.line2 || '',
        city: b.address.city || '',
        state: b.address.state || '',
        zip: b.address.zip || '',
      };
    }

    if (b.payMethod !== undefined) emp.payMethod = b.payMethod;
    if (b.directDeposit) {
      emp.directDeposit = {
        accountType: b.directDeposit.accountType || '',
        bankName: b.directDeposit.bankName || '',
        routingNumber: b.directDeposit.routingNumber || '',
        accountNumberLast4: b.directDeposit.accountNumberLast4 || '',
      };
    }

    if (b.payType !== undefined) emp.payType = b.payType;
    if (b.hourlyRate !== undefined) emp.hourlyRate = b.hourlyRate;
    if (b.salaryAmount !== undefined) emp.salaryAmount = b.salaryAmount;
    if (b.payFrequency !== undefined) emp.payFrequency = b.payFrequency;

    if (b.hireDate !== undefined)
      emp.hireDate = b.hireDate ? new Date(b.hireDate) : emp.hireDate;
    if (b.startDate !== undefined)
      emp.startDate = b.startDate ? new Date(b.startDate) : emp.startDate;
    if (b.status !== undefined) emp.status = b.status;

    if (b.filingStatus !== undefined) emp.filingStatus = b.filingStatus;
    if (b.federalWithholdingRate !== undefined)
      emp.federalWithholdingRate = b.federalWithholdingRate;
    if (b.stateWithholdingRate !== undefined)
      emp.stateWithholdingRate = b.stateWithholdingRate;
    if (b.federalAllowances !== undefined)
      emp.federalAllowances = b.federalAllowances;
    if (b.stateAllowances !== undefined)
      emp.stateAllowances = b.stateAllowances;
    if (b.extraFederalWithholding !== undefined)
      emp.extraFederalWithholding = b.extraFederalWithholding;
    if (b.extraStateWithholding !== undefined)
      emp.extraStateWithholding = b.extraStateWithholding;
    if (b.stateCode !== undefined) emp.stateCode = b.stateCode;

    await emp.save();
    res.json({ employee: serializeEmployee(emp) });
  } catch (err) {
    console.error('PATCH /api/employees/:id error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
