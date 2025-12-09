// src/routes/employeesMe.js
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const Paystub = require('../models/Paystub');
const PayrollRun = require('../models/PayrollRun'); 
const { requireAuth } = require('../middleware/auth');

// Force all routes to require "Employee" role
router.use(requireAuth(['employee']));

// 1. GET PROFILE (View Dashboard)
router.get('/', async (req, res) => {
  try {
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
    const { phone, address, directDeposit, firstName, lastName, ssn } = req.body;
    const emp = await Employee.findById(req.user.id);

    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Update allowed flat fields
    if (phone) emp.phone = phone;
    if (firstName) emp.firstName = firstName;
    if (lastName) emp.lastName = lastName;
    if (ssn) emp.ssn = ssn;

    // ✅ FIX 1: Safe merging for Address
    if (address) {
        emp.address = { ...emp.address, ...address };
    }
    
    // ✅ FIX 2: Safe merging for Direct Deposit
    if (directDeposit) {
        // Use spread operator to merge with existing data
        emp.directDeposit = {
            ...emp.directDeposit,
            ...directDeposit, // Merge all incoming directDeposit fields
            // Auto-update the "Last 4" for security display
            accountNumberLast4: directDeposit.accountNumber ? directDeposit.accountNumber.slice(-4) : emp.directDeposit.accountNumberLast4
        };
    }
    
    // Note: The self-employed client also uses this route to edit their personal fields
    // which are also stored on this record. This needs to be handled via the corresponding PATCH route 
    // (/api/employers/me) and only the employee details should be handled here.

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
                    employee: req.user.id, 
                    payDate: { $gte: start, $lt: end } 
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
