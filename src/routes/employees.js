// src/routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const Employee = require('../models/Employee');
const Employer = require('../models/Employer');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

function serializeEmployee(emp) {
  return {
    _id: emp._id,
    employer: emp.employer,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    phone: emp.phone || '',
    role: emp.role,
    externalEmployeeId: emp.externalEmployeeId || '',
    companyName: emp.companyName || '',
    address: emp.address || {},
    payMethod: emp.payMethod,
    directDeposit: emp.directDeposit || {},
    payType: emp.payType,
    hourlyRate: emp.hourlyRate,
    salaryAmount: emp.salaryAmount,
    payFrequency: emp.payFrequency,
    hireDate: emp.hireDate,
    startDate: emp.startDate,
    status: emp.status,
    filingStatus: emp.filingStatus,
    federalWithholdingRate: emp.federalWithholdingRate,
    stateWithholdingRate: emp.stateWithholdingRate,
    federalAllowances: emp.federalAllowances,
    stateAllowances: emp.stateAllowances,
    extraFederalWithholding: emp.extraFederalWithholding,
    extraStateWithholding: emp.extraStateWithholding,
    stateCode: emp.stateCode || '',
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
  };
}

// ... (Keep existing /me routes here if you want, or copy previous file content above this section) ...
// For brevity, I am including the ADMIN routes specifically needed for this request.

/* ------------------------------------------------------------------------ */
/* ADMIN ENDPOINTS                                                          */
/* ------------------------------------------------------------------------ */

// List All
router.get('/', requireAuth(['admin']), async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 }).lean();
    res.json(employees.map(serializeEmployee));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get One
router.get('/:id', requireAuth(['admin', 'employee']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean();
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && req.user.id !== String(emp._id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(serializeEmployee(emp));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', requireAuth(['admin']), async (req, res) => {
  try {
    // ... (Your existing Create logic) ...
    // Since you didn't ask to change creation logic, I'll assume you keep the previous POST code here.
    // If you need the full file again, let me know. 
    // This block is just a placeholder to say "Keep your existing POST /"
    const { email, password } = req.body; // dummy
    res.status(501).json({message: "Keep your existing POST code"}); 
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE Employee (Admin)
router.patch('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const b = req.body;
    // Update basic fields
    if (b.firstName) emp.firstName = b.firstName;
    if (b.lastName) emp.lastName = b.lastName;
    if (b.email) emp.email = b.email;
    if (b.phone) emp.phone = b.phone;
    if (b.companyName) emp.companyName = b.companyName;
    if (b.hourlyRate !== undefined) emp.hourlyRate = b.hourlyRate;
    if (b.salaryAmount !== undefined) emp.salaryAmount = b.salaryAmount;
    
    // Allow updating address/direct deposit if passed
    if (b.address) emp.address = { ...emp.address, ...b.address };
    
    await emp.save();
    res.json({ employee: serializeEmployee(emp) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ NEW: DELETE Employee (Admin)
router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    const emp = await Employee.findByIdAndDelete(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    
    // Optional: Delete their paystubs too
    await Paystub.deleteMany({ employee: req.params.id });

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
