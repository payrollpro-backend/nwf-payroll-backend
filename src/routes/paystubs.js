const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { generatePaystubPdf } = require('../utils/paystubPdf');

const router = express.Router();

// List paystubs for an employee — OPEN (no auth)
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const requestedId = req.params.employeeId;

    const paystubs = await Paystub.find({ employee: requestedId })
      .sort({ payDate: -1 })
      .populate('payrollRun');

    res.json(paystubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download PDF — OPEN (no auth)
router.get('/:paystubId/download', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.paystubId)
      .populate('employee payrollRun');

    if (!paystub) {
      return res.status(404).json({ error: 'Paystub not found' });
    }

    generatePaystubPdf(res, paystub.employee, paystub.payrollRun, paystub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
