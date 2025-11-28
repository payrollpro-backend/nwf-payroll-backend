// src/routes/paystubs.js

const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

const router = express.Router();

/**
 * GET /api/paystubs/employee/:employeeId
 * List paystubs for a specific employee (JSON only).
 */
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    const stubs = await Paystub.find({ employee: employeeId })
      .sort({ payDate: -1 })
      .populate('payrollRun')
      .lean();

    const response = stubs.map((stub) => {
      const run = stub.payrollRun || {};
      return {
        id: stub._id,
        employee: stub.employee,
        payDate: stub.payDate || run.payDate,
        fileName: stub.fileName,
        grossPay: Number(run.grossPay || 0),
        netPay: Number(run.netPay || 0),
      };
    });

    res.json(response);
  } catch (err) {
    console.error('List paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/paystubs
 * Admin – list ALL paystubs (across all employees), newest first.
 */
router.get('/', async (req, res) => {
  try {
    const stubs = await Paystub.find()
      .sort({ payDate: -1 })
      .populate('employee')
      .populate('payrollRun')
      .lean();

    const response = stubs.map((stub) => {
      const run = stub.payrollRun || {};
      const emp = stub.employee || {};
      return {
        id: stub._id,
        employeeName: [emp.firstName, emp.lastName].filter(Boolean).join(' '),
        employeeId: emp._id,
        payDate: stub.payDate || run.payDate,
        grossPay: Number(run.grossPay || 0),
        netPay: Number(run.netPay || 0),
      };
    });

    res.json(response);
  } catch (err) {
    console.error('List ALL paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/paystubs/:id
 * Detailed JSON for a single paystub including YTD totals.
 */
router.get('/:id', async (req, res) => {
  try {
    const paystubId = req.params.id;

    const paystub = await Paystub.findById(paystubId)
      .populate('employee')
      .populate('payrollRun');

    if (!paystub) {
      return res.status(404).json({ error: 'Paystub not found' });
    }

    const employee = paystub.employee;
    const run = paystub.payrollRun;

    if (!run) {
      return res
        .status(400)
        .json({ error: 'This paystub has no payroll run attached' });
    }

    // ---- YTD CALCULATION: all runs in SAME YEAR up to this pay date ----
    const payDate = new Date(paystub.payDate || run.payDate);
    const yearStart = new Date(payDate.getFullYear(), 0, 1);

    const runsThisYear = await PayrollRun.find({
      employee: employee._id,
      payDate: { $gte: yearStart, $lte: payDate },
    }).lean();

    let ytdGross = 0;
    let ytdFederal = 0;
    let ytdState = 0;
    let ytdSS = 0;
    let ytdMedicare = 0;
    let ytdTaxes = 0;
    let ytdNet = 0;

    for (const r of runsThisYear) {
      const gross = Number(r.grossPay || 0);
      const fed = Number(r.federalIncomeTax || 0);
      const st = Number(r.stateIncomeTax || 0);
      const ss = Number(r.socialSecurity || 0);
      const med = Number(r.medicare || 0);
      const taxes =
        Number(r.totalTaxes || 0) || fed + st + ss + med;
      const net = Number(r.netPay || (gross - taxes));

      ytdGross += gross;
      ytdFederal += fed;
      ytdState += st;
      ytdSS += ss;
      ytdMedicare += med;
      ytdTaxes += taxes;
      ytdNet += net;
    }

    const ytdData = {
      gross: ytdGross,
      federal: ytdFederal,
      state: ytdState,
      socialSecurity: ytdSS,
      medicare: ytdMedicare,
      totalTaxes: ytdTaxes,
      net: ytdNet,
    };

    res.json({
      paystubId: paystub._id,
      employee: {
        id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        externalEmployeeId: employee.externalEmployeeId,
        companyName: employee.companyName,
        address: employee.address,
      },
      payrollRun: run,
      ytd: ytdData,
    });
  } catch (err) {
    console.error('Get single paystub error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
