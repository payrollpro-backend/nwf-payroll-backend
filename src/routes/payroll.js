const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function calculateNetPay(gross) {
  return gross * 0.9;
}

router.post('/run', requireAuth, requireAdmin, async (req, res) => {
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

    const rate = hourlyRate || employee.hourlyRate;
    const grossPay = rate * hoursWorked;
    const netPay = calculateNetPay(grossPay);

    const payrollRun = await PayrollRun.create({
      employee: employee._id,
      periodStart,
      periodEnd,
      hoursWorked,
      grossPay,
      netPay,
      notes,
    });

    const payDate = new Date(periodEnd);
    const iso = payDate.toISOString().slice(0, 10);
    const fileName = `nwf_${iso}.pdf`;

    const paystub = await Paystub.create({
      employee: employee._id,
      payrollRun: payrollRun._id,
      payDate,
      fileName,
    });

    res.status(201).json({ payrollRun, paystub });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;