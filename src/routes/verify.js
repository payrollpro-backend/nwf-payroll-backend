// src/routes/verify.js
const express = require('express');
const router = express.Router();
const Paystub = require('../models/Paystub');

// POST /api/verify-paystub
// Expects: { "code": "ABC-123" }
// Returns: JSON { valid: true, employeeName: "John Doe", ... }
router.post('/', async (req, res) => {
  try {
    const { code } = req.body;
    
    // Normalize code (trim spaces, uppercase)
    const cleanCode = (code || '').trim().toUpperCase();

    if (!cleanCode) {
        return res.status(400).json({ error: 'Verification code is required' });
    }

    // Find paystub by code
    const stub = await Paystub.findOne({ verificationCode: cleanCode })
        .populate('employee'); // Get Employee Name/Company

    if (!stub) {
        return res.status(404).json({ valid: false, message: "Code not found or expired." });
    }

    const employee = stub.employee || {};

    // Return SAFE public info (No SSN, No Address)
    res.json({
        valid: true,
        verificationCode: stub.verificationCode,
        employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        company: employee.companyName || "NWF Payroll Services",
        payDate: stub.payDate,
        netPay: stub.netPay,
        checkNumber: stub.checkNumber || "1080",
        periodStart: stub.periodStart || stub.payPeriodStart,
        periodEnd: stub.periodEnd || stub.payPeriodEnd
    });

  } catch (err) {
    console.error("Verify Error:", err);
    res.status(500).json({ error: "Server error during verification." });
  }
});

module.exports = router;
