const express = require('express');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');
const { generatePaystubPdf } = require('../utils/paystubPdf');

const router = express.Router();

// List paystubs for an employee
router.get('/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const requestedId = req.params.employeeId;
    const user = req.user;

    if (user.role !== 'admin' && user._id.toString() !== requestedId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const paystubs = await Paystub.find({ employee: requestedId })
      .sort({ payDate: -1 })
      .populate('payrollRun');
    res.json(paystubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download PDF
router.get('/:paystubId/download', requireAuth, async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.paystubId).populate(
      'employee payrollRun'
    );
    if (!paystub) {
      return res.status(404).json({ error: 'Paystub not found' });
    }

    const user = req.user;
    if (user.role !== 'admin' && user._id.toString() !== paystub.employee._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    generatePaystubPdf(res, paystub.employee, paystub.payrollRun, paystub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;