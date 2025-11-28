// src/routes/paystubs.js

const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');
const { generatePaystubPdf } = require('../utils/paystubPdf');

const router = express.Router();

/**
 * GET /api/paystubs/employee/:employeeId
 * List paystubs for a specific employee (admin or that employee).
 */
router.get('/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const requestedId = req.params.employeeId;
    const user = req.user;

    // Admin can see all; employee can only see their own
    if (user.role !== 'admin' && user._id.toString() !== requestedId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const stubs = await Paystub.find({ employee: requestedId })
      .sort({ payDate: -1 })
      .populate('payrollRun')
      .lean();

    const response = stubs.map((stub) => {
      const run = stub.payrollRun || {};
      return {
        id: stub._id,
        payDate: stub.payDate || run.payDate,
        fileName: stub.fileName,
        grossPay: run.grossPay || 0,
        netPay: run.netPay || 0,
      };
    });

    res.json(response);
  } catch (err) {
    console.error('List paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/paystubs/:id/pdf
 * Return a PDF that visually matches the sample stub.
 * Computes YTD based on all runs in the SAME YEAR up to this pay date.
 */
router.get('/:id/pdf', requireAuth, async (req, res) => {
  try {
    const paystubId = req.params.id;

    const paystub = await Paystub.findById(paystubId)
      .populate('employee')
      .populate('payrollRun');

    if (!paystub) {
      return res.status(404).json({ error: 'Paystub not found' });
    }

    const user = req.user;

    // Only admin or that employee can see it
    if (
      user.role !== 'admin' &&
      user._id.toString() !== paystub.employee._id.toString()
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const employee = paystub.employee;
    const run = paystub.payrollRun;

    if (!run) {
      return res.status(400).json({ error: 'This paystub has no payroll run attached' });
    }

    // ---- YTD CALCULATION (YEAR-TO-DATE) ----
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
    let ytdNet = 0;
    let ytdTaxes = 0;

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

    // Headers for browser
    res.setHeader('Content-Type', 'application/pdf');
    const safeFile =
      paystub.fileName || `paystub_${employee._id}_${payDate.toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Disposition', `inline; filename="${safeFile}"`);

    // Generate the PDF (this writes directly to res)
    generatePaystubPdf(res, employee, run, paystub, ytdData);
  } catch (err) {
    console.error('Paystub PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
