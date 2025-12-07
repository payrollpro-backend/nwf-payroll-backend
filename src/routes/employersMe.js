// src/routes/employersMe.js
const express = require('express');
const mongoose = require('mongoose'); // Required for aggregation
const { requireAuth } = require('../middleware/auth');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

const router = express.Router();

router.use(requireAuth(['employer', 'admin']));

function getEmployerIdFromUser(payload) {
  if (payload.employerId) return payload.employerId;
  return payload.id;
}

// ✅ NEW: Dashboard Stats (Correctly Calculates Company-Wide YTD)
router.get('/me/dashboard-stats', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    // 1. Get Employee Count
    const employeeCount = await Employee.countDocuments({
        employer: employerId,
        role: 'employee',
        status: 'Active'
    });

    // 2. Aggregate Company-Wide YTD Totals (Sum of all runs this year)
    const stats = await PayrollRun.aggregate([
        { 
            $match: { 
                employer: new mongoose.Types.ObjectId(employerId),
                payDate: { $gte: startOfYear } 
            } 
        },
        {
            $group: {
                _id: null,
                totalGross: { $sum: "$grossPay" },
                totalTaxes: { $sum: "$totalTaxes" }
            }
        }
    ]);

    // 3. Get Info from the VERY LAST Run (for "Latest Run" cards)
    const latestRun = await PayrollRun.findOne({ employer: employerId })
        .sort({ payDate: -1, createdAt: -1 });

    res.json({
        employees: employeeCount,
        ytdGross: stats[0]?.totalGross || 0,
        ytdTaxes: stats[0]?.totalTaxes || 0,
        latestRunGross: latestRun?.grossPay || 0,
        latestRunTaxes: latestRun?.totalTaxes || 0,
        latestRunDate: latestRun?.payDate || null
    });

  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET Employer Profile
router.get('/me', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);
    const employerUser = await Employee.findById(employerId).lean();

    if (!employerUser) {
      return res.json({ id: employerId, companyName: 'Company', contactEmail: req.user.email });
    }
    const addr = employerUser.address || {};
    res.json({
      id: employerUser._id,
      companyName: employerUser.companyName || '',
      contactEmail: employerUser.email || '',
      contactName: `${employerUser.firstName} ${employerUser.lastName}`,
      addressLine1: addr.line1 || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zip || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// GET Employees
router.get('/me/employees', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);
    const employees = await Employee.find({ employer: employerId, role: 'employee' })
      .sort({ createdAt: -1 }).lean();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employees' });
  }
});

// GET Payroll Runs
router.get('/me/payroll-runs', async (req, res) => {
  try {
    const employerId = getEmployerIdFromUser(req.user);
    const runs = await PayrollRun.find({ employer: employerId })
      .sort({ payDate: -1, createdAt: -1 })
      .limit(20)
      .lean();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load runs' });
  }
});

module.exports = router;
