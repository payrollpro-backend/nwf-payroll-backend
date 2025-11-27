const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

const router = express.Router();

function calcFica(gross) {
  const socialSecurity = gross * 0.062;
  const medicare = gross * 0.0145;
  return { socialSecurity, medicare };
}

router.post('/run', async (req, res) => {
  try {
    const {
      employeeId,
      periodStart,
      periodEnd,
      hoursWorked,
      hourlyRate,
      notes,
    } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const hours = Number(hoursWorked || 0);
    const rate = Number(hourlyRate || employee.hourlyRate || 0);

    const grossPay = rate * hours;

    const { socialSecurity, medicare } = calcFica(grossPay);
    const fedRate = employee.federalWithholdingRate || 0.18;
    const stateRate = employee.stateWithholdingRate || 0.05;

    const federalIncomeTax = grossPay * fedRate;
    const stateIncomeTax = grossPay * stateRate;

    const totalTaxes =
      federalIncomeTax + stateIncomeTax + socialSecurity + medicare;

    const netPay = grossPay - totalTaxes;

    // ✅ Use periodEnd as the pay date (your existing behavior)
    const payDate = new Date(periodEnd);

    /*
      ✅ YTD LOGIC STARTS HERE
      - Look up prior PayrollRun docs for this employee in the same year
      - Start from Jan 1 OR employee.startDate (whichever is later)
      - Sum all prior per-period amounts
    */

    // Jan 1 of same year as this payDate
    const yearStart = new Date(payDate.getFullYear(), 0, 1);

    // Start YTD from either Jan 1 or employee.startDate, whichever is later
    let ytdStart = yearStart;
    if (employee.startDate && employee.startDate > yearStart) {
      ytdStart = employee.startDate;
    }

    const priorRuns = await PayrollRun.find({
      employee: employee._id,
      payDate: {
        $gte: ytdStart,
        $lt: payDate, // strictly before this pay date
      },
    });

    let ytdGrossBefore = 0;
    let ytdFedBefore = 0;
    let ytdStateBefore = 0;
    let ytdSsBefore = 0;
    let ytdMedBefore = 0;
    let ytdTaxesBefore = 0;

    priorRuns.forEach(run => {
      ytdGrossBefore += run.grossPay || 0;
      ytdFedBefore += run.federalIncomeTax || 0;
      ytdStateBefore += run.stateIncomeTax || 0;
      ytdSsBefore += run.socialSecurity || 0;
      ytdMedBefore += run.medicare || 0;
      ytdTaxesBefore += run.totalTaxes || 0;
    });

    // Add current period to get new YTD totals
    const ytdGrossPay = ytdGrossBefore + grossPay;
    const ytdFederalIncomeTax = ytdFedBefore + federalIncomeTax;
    const ytdStateIncomeTax = ytdStateBefore + stateIncomeTax;
    const ytdSocialSecurity = ytdSsBefore + socialSecurity;
    const ytdMedicare = ytdMedBefore + medicare;
    const ytdTotalTaxes = ytdTaxesBefore + totalTaxes;
    const ytdNetPay = ytdGrossPay - ytdTotalTaxes;

    /*
      ✅ YTD LOGIC ENDS HERE
    */

    const payrollRun = await PayrollRun.create({
      employee: employee._id,
      periodStart,
      periodEnd,
      hoursWorked: hours,
      hourlyRate: rate,
      grossPay,
      netPay,
      federalIncomeTax,
      stateIncomeTax,
      socialSecurity,
      medicare,
      totalTaxes,
      notes,
      payDate,

      // Save YTD values into this run
      ytdGrossPay,
      ytdNetPay,
      ytdFederalIncomeTax,
      ytdStateIncomeTax,
      ytdSocialSecurity,
      ytdMedicare,
      ytdTotalTaxes,
    });

    // filename: nwf_<last4 of Emp_ID>_<YYYY-MM-DD>.pdf
    const isoDate = payDate.toISOString().slice(0, 10);
    const extId = employee.externalEmployeeId || '';
    const digitsOnly = extId.replace(/\D/g, '');
    const last4 = digitsOnly.slice(-4) || '0000';

    const fileName = `nwf_${last4}_${isoDate}.pdf`;

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

module.exports = router;
