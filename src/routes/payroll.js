// src/routes/payroll.js
const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { computeTaxesForPaycheck } = require('../services/taxCalculator');
const { requireAuth } = require('../middleware/auth'); // Ensure auth is imported for req.user.id

const router = express.Router();

/**
 * POST /api/payroll/run
 * Create a single payroll run + paystub for one employee.
 */
router.post('/run', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const {
      employeeId,
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
      return res.status(400).json({ error: 'employeeId, payDate, and grossPay are required' });
    }

    const employee = await Employee.findById(employeeId);
    const employer = await Employee.findById(req.user.id);
    
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    
    // ✅ NEW CHECK: Enforce solo payroll for self-employed users
    if (employer.isSelfEmployed) {
        if (String(employeeId) !== String(req.user.id)) {
            return res.status(403).json({ error: "Self-Employed accounts can only run payroll for themselves." });
        }
    }


    const gross = parseFloat(grossPay);
    const payDateObj = new Date(payDate);
    const yearStart = new Date(payDateObj.getFullYear(), 0, 1);
    
    // YTD Calculation
    const prevAgg = await PayrollRun.aggregate([
      {
        $match: {
          employee: employee._id,
          payDate: { $gte: yearStart, $lt: payDateObj },
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
    const prev = prevAgg[0] || { gross: 0, net: 0, fed: 0, state: 0, ss: 0, med: 0, taxes: 0 };

    const taxes = computeTaxesForPaycheck(employee, gross);

    // 1. Create Payroll Run
    const payrollRun = await PayrollRun.create({
      employee: employee._id,
      employer: employee.employer, // Link to Employer
      payType: employee.payType || 'hourly',
      payFrequency: employee.payFrequency || 'biweekly',
      periodStart: periodStart || payPeriodStart,
      periodEnd: periodEnd || payPeriodEnd,
      payDate: payDateObj,
      hoursWorked: hoursWorked || 0,
      grossPay: gross,
      ...taxes, 
      
      // YTD
      ytdGross: prev.gross + gross,
      ytdNet: prev.net + taxes.netPay,
      ytdFederalIncomeTax: prev.fed + taxes.federalIncomeTax,
      ytdStateIncomeTax: prev.state + taxes.stateIncomeTax,
      ytdSocialSecurity: prev.ss + taxes.socialSecurity,
      ytdMedicare: prev.med + taxes.medicare,
      ytdTotalTaxes: prev.taxes + taxes.totalTaxes,
      notes
    });

    // 2. Create Paystub
    // Generate clean verification code
    const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + 
                       Math.random().toString(36).substring(2, 6).toUpperCase();

    const paystub = await Paystub.create({
      employee: employee._id,
      employer: employee.employer, 
      payrollRun: payrollRun._id,
      payDate: payDateObj,
      
      payPeriodStart: periodStart || payPeriodStart,
      payPeriodEnd: periodEnd || payPeriodEnd,
      
      fileName: `paystub-${employee._id}-${payDateObj.toISOString().split('T')[0]}.pdf`,
      verificationCode: uniqueCode,

      // Current
      grossPay: gross,
      ...taxes,

      // YTD
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
    console.error('Run Payroll Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List
router.get('/', async (req, res) => {
  try {
    const runs = await PayrollRun.find().populate('employee').sort({ createdAt: -1 });
    res.json(runs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const runId = req.params.id;
    const updates = req.body;
    const run = await PayrollRun.findByIdAndUpdate(runId, updates, { new: true });
    if (!run) return res.status(404).json({ error: 'Not found' });
    await Paystub.findOneAndUpdate({ payrollRun: runId }, updates);
    res.json(run);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const runId = req.params.id;
    await PayrollRun.findByIdAndDelete(runId);
    await Paystub.findOneAndDelete({ payrollRun: runId });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
