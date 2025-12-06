// src/routes/employeesMe.js
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

// Force all routes to require "Employee" role
router.use(requireAuth(['employee']));

// 1. GET PROFILE (View Dashboard)
router.get('/', async (req, res) => {
  try {
    // Return the logged-in user's profile
    const emp = await Employee.findById(req.user.id).select('-passwordHash -invitationToken');
    if (!emp) return res.status(404).json({ error: 'Profile not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. UPDATE PROFILE (Edit Address, Phone, Bank)
router.put('/', async (req, res) => {
  try {
    const { phone, address, directDeposit } = req.body;
    const emp = await Employee.findById(req.user.id);

    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Update allowed fields
    if (phone) emp.phone = phone;
    if (address) {
        emp.address = { ...emp.address, ...address };
    }
    
    // Update Bank Info safely
    if (directDeposit) {
        emp.directDeposit = {
            ...emp.directDeposit,
            bankName: directDeposit.bankName,
            accountType: directDeposit.accountType,
            routingNumber: directDeposit.routingNumber,
            accountNumber: directDeposit.accountNumber,
            // Auto-update the "Last 4" for security display
            accountNumberLast4: directDeposit.accountNumber ? directDeposit.accountNumber.slice(-4) : emp.directDeposit.accountNumberLast4
        };
    }

    await emp.save();
    res.json({ message: 'Profile updated successfully', employee: emp });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 3. GET PAYSTUBS
router.get('/paystubs', async (req, res) => {
  try {
    const stubs = await Paystub.find({ employee: req.user.id })
      .sort({ payDate: -1 }) // Newest first
      .limit(50);
    res.json(stubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GENERATE W-2 SUMMARY (Aggregates Payroll Runs for a Year)
router.get('/w2', async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        const start = new Date(year, 0, 1);       // Jan 1
        const end = new Date(year + 1, 0, 1);     // Jan 1 Next Year

        // Aggregate all runs for this employee in that date range
        const stats = await PayrollRun.aggregate([
            { 
                $match: { 
                    employee: req.user.id, // Only this user's data
                    payDate: { $gte: start, $lt: end } // Within the selected year
                } 
            },
            {
                $group: {
                    _id: null,
                    wages: { $sum: "$grossPay" },
                    federalIncomeTax: { $sum: "$federalIncomeTax" },
                    stateIncomeTax: { $sum: "$stateIncomeTax" },
                    socialSecurity: { $sum: "$socialSecurity" },
                    medicare: { $sum: "$medicare" },
                    totalTax: { $sum: "$totalTaxes" }
                }
            }
        ]);

        const result = stats[0] || { 
            wages: 0, federalIncomeTax: 0, stateIncomeTax: 0, 
            socialSecurity: 0, medicare: 0, totalTax: 0 
        };

        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
