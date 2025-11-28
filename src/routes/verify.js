const express = require('express');
const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

const router = express.Router();

router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    const stub = await Paystub.findOne({ verificationCode: code })
      .populate('employee', 'firstName lastName externalEmployeeId email');

    if (!stub) {
      return res.status(404).json({
        verified: false,
        message: 'No paystub found for this verification code.',
      });
    }

    const employee = stub.employee;

    return res.json({
      verified: true,
      verificationCode: code,

      paystubId: stub._id,
      employee: {
        name: `${employee.firstName} ${employee.lastName}`,
        externalId: employee.externalEmployeeId,
      },

      payDate: stub.payDate,
      netPay: stub.netPay,
      employer: 'NSE MANAGEMENT INC',
      generatedAt: stub.createdAt,

      message: 'This paystub has been verified by NWF Payroll Services.',
    });
  } catch (err) {
    console.error('Verification error:', err);
    return res.status(500).json({
      verified: false,
      message: 'Server error verifying paystub.',
    });
  }
});

module.exports = router;
