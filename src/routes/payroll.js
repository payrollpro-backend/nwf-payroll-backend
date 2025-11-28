// src/routes/payroll.js

const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

const router = express.Router();

/**
 * Simple tax helper – replace with real tax logic later.
 * Uses employee-level withholding rates if present,
 * otherwise falls back to basic defaults.
 */
function calculateTaxes(employee, gross) {
  const g = Number(gross) || 0;

  // Use stored employee rates if present, or defaults
  const fedRate =
    typeof employee.federalWithholdingRate === 'number'
      ? employee.federalWithholdingRate
      : 0.18; // 18% default

  const stateRate =
    typeof employee.stateWithholdingRate === 'number'
      ? employee.stateWithholdingRate
      : 0.05; // 5% default

  const federalIncomeTax = g * fedRate;
  const stateIncomeTax = g * stateRate;

  // Standard FICA (you can later make caps, etc.)
  const socialSecurity = g * 0.062;
  const medicare = g * 0.0145;

  const totalTaxes =
    federalIncomeTax + stateIncomeTax + socialSecurity + medicare;
  const netPay = g - totalTaxes;

  return {
    federalIncomeTax,
    stateIncomeTax,
    socialSecurity,
    medicare,
    totalTaxes,
    netPay,
  };
}

/**
 * POST /api/payroll/run
 * Create a single payroll run + paystub for one employee,
 * including YTD calculations based on calendar year + hire date.
 */
router.post('/run', async (req, res) => {
  try {
    const {
      employeeId,
      // accept both your old and new naming
      payPeriodStart,
      payPeriodEnd,
      periodStart,
      periodEnd,
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

    const gross = Number(grossPay);
    if (Number.isNaN(gross) || gross <= 0) {
      return res.status(400).json({ error: 'grossPay must be a positive number' });
    }

    // Use our tax helper to get breakdown + net
    const {
      federalIncomeTax,
      stateIncomeTax,
      socialSecurity,
      medicare,
      totalTaxes,
      netPay,
    } = calculateTaxes(employee, gross);

    // Normalize period fields (so your DB uses consistent names)
    const finalPeriodStart = periodStart || payPeriodStart || null;
    const finalPeriodEnd = periodEnd || payPeriodEnd || null;

    // ---------- YTD CALCULATION (calendar year, from hire date onward) ----------
    const payDateObj = new Date(payDate);
    if (Number.isNaN(payDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid payDate' });
    }

    const yearStart = new Date(payDateObj.getFullYear(), 0, 1); // Jan 1

    const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;
    const ytdStart = hireDate && hireDate > yearStart ? hireDate : yearStart;

    const prevAgg = await PayrollRun.aggregate([
      {
        $match: {
          employee: employee._id,
          payDate: { $gte: ytdStart, $lt: payDateObj },
        },
      },
      {
        $group: {
          _id: null,
          gross: { $sum: '$grossPay' },
          net: { $sum: '$netPay' },
          fed: { $sum: '$federalIncomeTax' },
          state: { $sum: '$stateIncomeTax' },
          ss: { $sum: '$socialSecurity' },
          med: { $sum: '$medicare' },
          taxes: { $sum: '$totalTaxes' },
        },
      },
    ]);

    const prev = prevAgg[0] || {
      gross: 0,
      net: 0,
      fed: 0,
      state: 0,
      ss: 0,
      med: 0,
      taxes: 0,
    };

    // ---------- Create payroll run with YTD snapshot ----------
    const payrollRun = await PayrollRun.create({
      employee: employee._id,
      employer: employee.employer || null,

      // freeze pay settings at the time of the run (if present on Employee)
      payType: employee.payType || 'hourly',
      payFrequency: employee.payFrequency || 'biweekly',

      periodStart: finalPeriodStart ? new Date(finalPeriodStart) : null,
      periodEnd: finalPeriodEnd ? new Date(finalPeriodEnd) : null,
      payDate: payDateObj,
      hoursWorked: Number(hoursWorked) || 0,
      hourlyRate: employee.hourlyRate || 0,

      grossPay: gross,
      netPay,
      federalIncomeTax,
      stateIncomeTax,
      socialSecurity,
      medicare,
      totalTaxes,

      // YTD = previous runs in year + this run
      ytdGross: prev.gross + gross,
      ytdNet: prev.net + netPay,
      ytdFederalIncomeTax: prev.fed + federalIncomeTax,
      ytdStateIncomeTax: prev.state + stateIncomeTax,
      ytdSocialSecurity: prev.ss + socialSecurity,
      ytdMedicare: prev.med + medicare,
      ytdTotalTaxes: prev.taxes + totalTaxes,

      notes,
    });

    // ---------- Create Paystub record ----------
    // Prefer externalEmployeeId if you’re using that Emp_ID_XXXXXXXX style
    const baseEmpId =
      employee.externalEmployeeId ||
      employee.employeeId ||
      employee._id.toString();

    const payDatePart = payDateObj.toISOString().slice(0, 10); // YYYY-MM-DD
    const fileName = `nwf_${baseEmpId}_${payDatePart}.pdf`;

    const paystub = await Paystub.create({
      employee: employee._id,
      payrollRun: payrollRun._id,
      payDate: payDateObj,
      fileName,
      // you can also copy YTD onto the paystub if you want it frozen there too
      ytdGross: payrollRun.ytdGross,
      ytdNet: payrollRun.ytdNet,
      ytdFederalIncomeTax: payrollRun.ytdFederalIncomeTax,
      ytdStateIncomeTax: payrollRun.ytdStateIncomeTax,
      ytdSocialSecurity: payrollRun.ytdSocialSecurity,
      ytdMedicare: payrollRun.ytdMedicare,
      ytdTotalTaxes: payrollRun.ytdTotalTaxes,
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
 * List all payroll runs
 */
router.get('/', listRunsHandler);

/**
 * GET /api/payroll/runs
 * Alias – in case frontend calls /runs
 */
router.get('/runs', listRunsHandler);

module.exports = router;
