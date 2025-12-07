// src/routes/employersMe.js
const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');

const router = express.Router();

router.use(requireAuth(['employer', 'admin']));

function getEmployerIdFromUser(payload) {
  if (payload.employerId) return payload.employerId;
  return payload.id;
}

// --------------------------------------------------------
// ✅ NEW: TAX FEATURES
// --------------------------------------------------------

// 1. Get Tax Liability Breakdown
router.get('/me/tax-liability/:runId', async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.runId).populate('employee');
    if (!run) return res.status(404).json({ error: "Run not found" });

    // Calculate Employer Portion (Standard 2025 Rates)
    // If not saved in DB, calculate on fly
    const gross = run.grossPay || 0;
    const erSS = run.employerSocialSecurity || (gross * 0.062);
    const erMed = run.employerMedicare || (gross * 0.0145);
    const erFUTA = run.employerFUTA || (gross * 0.006); // 0.6% FUTA estimate
    
    const totalEmployerTax = erSS + erMed + erFUTA;
    const totalEmployeeTax = run.totalTaxes; // Already withheld
    const grandTotal = totalEmployerTax + totalEmployeeTax;

    res.json({
        runId: run._id,
        employeeName: `${run.employee.firstName} ${run.employee.lastName}`,
        payDate: run.payDate,
        status: run.taxFilingStatus || 'Pending',
        
        // Breakdown for Modal
        employeeWithholding: {
            fed: run.federalIncomeTax,
            state: run.stateIncomeTax,
            ss: run.socialSecurity,
            med: run.medicare,
            total: totalEmployeeTax
        },
        employerTaxes: {
            ssMatch: erSS,
            medMatch: erMed,
            futa: erFUTA,
            total: totalEmployerTax
        },
        grandTotal: grandTotal
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Submit Filing Action
router.post('/me/tax-action', async (req, res) => {
    try {
        const { runId, action } = req.body; // 'self' or 'nwf'
        
        // Update Status based on choice
        const status = (action === 'nwf') ? 'Requested-NWF' : 'Self-Filed';
        
        await PayrollRun.findByIdAndUpdate(runId, { taxFilingStatus: status });

        res.json({ success: true, status: status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------------
// EXISTING DASHBOARD ROUTES
// --------------------------------------------------------

// Dashboard Stats
router.get('/me/dashboard-stats', async (req, res) => {
  try {
    const rawId = getEmployerIdFromUser(req.user);
    const employerId = new mongoose.Types.ObjectId(rawId);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    const employeeCount = await Employee.countDocuments({
        employer: employerId,
        role: 'employee',
        status: 'active' 
    });

    const stats = await PayrollRun.aggregate([
        { $match: { employer: employerId, payDate: { $gte: startOfYear } } },
        { $group: { _id: null, totalGross: { $sum: "$grossPay" }, totalTaxes: { $sum: "$totalTaxes" } } }
    ]);

    const latestRun = await PayrollRun.findOne({ employer: employerId }).sort({ payDate: -1, createdAt: -1 });

    res.json({
        employees: employeeCount,
        ytdGross: stats[0]?.totalGross || 0,
        ytdTaxes: stats[0]?.totalTaxes || 0,
        latestRunGross: latestRun?.grossPay || 0,
        latestRunTaxes: latestRun?.totalTaxes || 0,
        latestRunDate: latestRun?.payDate || null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get Profile
router.get('/me', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);
    const user = await Employee.findById(employerId).lean();
    if (!user) return res.json({ id: employerId, companyName: 'Company' });
    
    res.json({
      id: user._id,
      companyName: user.companyName || '',
      contactEmail: user.email || '',
      contactName: `${user.firstName} ${user.lastName}`,
      addressLine1: user.address?.line1 || '',
      city: user.address?.city || '',
      state: user.address?.state || '',
      zip: user.address?.zip || '',
    });
  } catch (err) { res.status(500).json({ error: 'Failed to load profile' }); }
});

// Get Employees
router.get('/me/employees', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);
    const employees = await Employee.find({ employer: employerId, role: 'employee' }).sort({ createdAt: -1 }).lean();
    res.json(employees);
  } catch (err) { res.status(500).json({ error: 'Failed to load employees' }); }
});

// Get Payroll Runs
router.get('/me/payroll-runs', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);
    const runs = await PayrollRun.find({ employer: employerId }).sort({ payDate: -1, createdAt: -1 }).limit(20).lean();
    res.json(runs);
  } catch (err) { res.status(500).json({ error: 'Failed to load runs' }); }
});

module.exports = router;
