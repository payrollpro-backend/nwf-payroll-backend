const express = require('express');
const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const { generatePaystubPdf } = require('../utils/paystubPdf');

const router = express.Router();

// List paystubs for an employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const paystubs = await Paystub.find({ employee: req.params.employeeId })
      .sort({ payDate: -1 })
      .populate('payrollRun');
    res.json(paystubs);
  } catch (err) {
    console.error('list paystubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download a paystub PDF
router.get('/:paystubId/download', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.paystubId)
      .populate('employee payrollRun');
    if (!paystub) {
      return res.status(404).json({ error: 'Paystub not found' });
    }

    await generatePaystubPdf(res, paystub.employee, paystub.payrollRun, paystub);
  } catch (err) {
    console.error('download paystub error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
