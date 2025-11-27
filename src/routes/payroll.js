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

    const payDate = new Date(periodEnd);

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
