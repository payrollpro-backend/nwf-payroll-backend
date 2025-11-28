// routes/paystubs.js
const express = require('express');
const mongoose = require('mongoose');

const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

const router = express.Router();

// GET /api/paystubs
// Admin: list all paystubs
router.get('/', async (req, res) => {
  try {
    const paystubs = await Paystub.find()
      .populate('employee', 'firstName lastName email externalEmployeeId')
      .sort({ payDate: -1 });

    res.json(paystubs);
  } catch (err) {
    console.error('Error fetching paystubs:', err);
    res.status(500).json({ message: 'Server error fetching paystubs' });
  }
});

// GET /api/paystubs/employee/:employeeId
// Employee: list paystubs by employee
// Accepts either Mongo _id OR externalEmployeeId (like Emp_ID_00000001)
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    const query = {};
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      query._id = employeeId; // Mongo id
    } else {
      query.externalEmployeeId = employeeId; // human-readable id
    }

    const employee = await Employee.findOne(query);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const stubs = await Paystub.find({ employee: employee._id })
      .sort({ payDate: -1 });

    res.json(stubs);
  } catch (err) {
    console.error('Error fetching paystubs by employee:', err);
    res.status(500).json({ message: 'Server error fetching employee paystubs' });
  }
});

// GET /api/paystubs/:id
// Single paystub by its own Paystub _id
router.get('/:id', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id)
      .populate('employee', 'firstName lastName email externalEmployeeId');

    if (!stub) {
      return res.status(404).json({ message: 'Paystub not found' });
    }

    res.json(stub);
  } catch (err) {
    console.error('Error fetching paystub by id:', err);
    res.status(500).json({ message: 'Server error fetching paystub' });
  }
});

module.exports = router;
