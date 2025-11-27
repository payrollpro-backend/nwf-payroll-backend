// src/routes/payroll.js

const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Simple placeholder for now – you can replace with real tax logic later
function calculateNetPay(gross) {
  return gross * 0.9;
}

/**
 * POST /api/payroll/run
 * Create a single payroll run + paystub for one employee
 */
router.post('/run', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      employeeId,
      payPeriodStart,
      payPeriodEnd,
      payDate,
      hoursWorked,
      grossPay,
      notes,
    } = req.body;

    if (!employeeId || !payDate || !grossPay) {
      return res.status(400).json({
        error: 'employeeId, payDate, and grossPay are required',
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const netPay = calculateNetPay(Number(grossPay));

    const payrollRun = await PayrollRun.create({
      employee: employee._id,
      payPeriodStart,
      payPeriodEnd,
      payDate,
      hoursWorked,
      grossPay,
      netPay,
      notes,
    });

    // Generate a simple filename for the paystub
    const empIdSafe = employee.employeeId || employee._id.toString();
    const payDatePart = new Date(payDate).toISOString().slice(0, 10); // YYYY-MM-DD
    const fileName = `nwf_${empIdSafe}_${payDatePart}.pdf`;

    const paystub = await Paystub.create({
      employee: employee._id,
      payrollRun: payrollRun._id,
      payDate,
      fileName,
    });

    res.status(201).json({ payrollRun, paystub });
  } catch (err) {
    console.error('payroll run error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Shared handler to list payroll runs
 */
async function listRunsHandler(req, res) {
  try {
    const runs = await PayrollRun.find()
      .populate('employee')
      .sort({ createdAt: -1 })
      .lean();

    res.json(runs);
  } catch (err) {
    console.error('list payroll runs error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/payroll
 * Admin – list all payroll runs
 */
router.get('/', requireAuth, requireAdmin, listRunsHandler);

/**
 * GET /api/payroll/runs
 * Admin – alias route, in case frontend calls /runs
 */
router.get('/runs', requireAuth, requireAdmin, listRunsHandler);

module.exports = router;
