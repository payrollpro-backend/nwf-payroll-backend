// src/routes/payroll.js

const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

// 🔹 NEW: import the payroll engine (make sure src/payrollEngine exists)
const { calculatePaycheck } = require('../payrollEngine');

const router = express.Router();

/**
 * POST /api/payroll/run
 * Create a single payroll run + paystub for one employee,
 * including YTD calculations based on calendar year + hire date.
 *
 * Now uses the NWF payroll engine for federal/FICA/GA state taxes.
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
      return res
        .status(400)
        .json({ error: 'grossPay must be a positive number' });
    }

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

    // Aggregate previous payroll runs in the same calendar year
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

    // ---------- FEED DATA INTO THE NEW PAYROLL ENGINE ----------

    // Hours / rate:
    const hours = Number(hoursWorked) || 0;
    // Prefer stored hourlyRate; if not present but we have hours, derive from gross
    const rate =
      typeof employee.hourlyRate === 'number' && employee.hourlyRate > 0
        ? employee.hourlyRate
        : hours > 0
        ? gross / hours
        : 0;

    // Pay frequency – default to biweekly if not on employee
    const payFrequency = employee.payFrequency || 'biweekly';

    // Filing status – default to single if not on employee
    const filingStatus = employee.filingStatus || 'single';

    // State – try to infer from employee fields, default to GA for now
    const stateCode =
      employee.stateCode ||
      employee.state ||
      (employee.address && employee.address.state) ||
      'GA';

    // Approximate YTD Social Security wages for cap logic:
    // prev.ss is YTD SS TAX; convert to wages by dividing by 6.2%
    const ytdSocialSecurityWages =
      prev.ss && prev.ss > 0 ? prev.ss / 0.062 : 0;

    // If you later track real pre-tax (401k, health), pass it here
    const preTaxDeductions = 0;

    // 🔹 Call the new engine
    const engineResult = calculatePaycheck({
      employeeId: employee._id.toString(),
      hours,
      rate,
      payFrequency,
      filingStatus,
      stateCode,
      ytdSocialSecurityWages,
      preTaxDeductions,
    });

    // engineResult contains: { gross, deductions: {...}, netPay }
    const {
      deductions: {
        federalIncomeTax,
        stateIncomeTax,
        socialSecurity,
        medicare,
        total: totalTaxes,
      },
      netPay,
    } = engineResult;

    // ---------- Create payroll run with YTD snapshot ----------

    const payrollRun = await PayrollRun.create({
      employee: employee._id,
      employer: employee.employer || null,

      // freeze pay settings at the time of the run (if present on Employee)
      payType: employee.payType || 'hourly',
      payFrequency,

      periodStart: finalPeriodStart ? new Date(finalPeriodStart) : null,
      periodEnd: finalPeriodEnd ? new Date(finalPeriodEnd) : null,
      payDate: payDateObj,
      hoursWorked: hours,
      hourlyRate: rate,

      // Use the original gross input (aligned with engineResult.gross)
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
      // copy YTD onto the paystub so it’s frozen there too
      ytdGross: payrollRun.ytdGross,
      ytdNet: payrollRun.ytdNet,
      ytdFederalIncomeTax: payrollRun.ytdFederalIncomeTax,
      ytdStateIncomeTax: payrollRun.ytdStateIncomeTax,
      ytdSocialSecurity: payrollRun.ytdSocialSecurity,
      ytdMedicare: payrollRun.ytdMedicare,
      ytdTotalTaxes: payrollRun.ytdTotalTaxes,
    });
