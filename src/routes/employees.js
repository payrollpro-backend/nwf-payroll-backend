// src/routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const Employee = require('../models/Employee');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');
const klaviyoService = require('../services/klaviyoService');

function serializeEmployee(emp) {
  return {
    _id: emp._id,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    phone: emp.phone || '',
    role: emp.role,
    companyName: emp.companyName || '',
    hourlyRate: emp.hourlyRate,
    salaryAmount: emp.salaryAmount,
    status: emp.status,
    createdAt: emp.createdAt,
  };
}

// ✅ LIST EMPLOYEES (Admin gets all, Employer gets their own)
router.get('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    let query = {};
    // If employer, restrict to their company
    if (req.user.role === 'employer') {
      query.employer = req.user.id;
    }
    
    const employees = await Employee.find(query).sort({ createdAt: -1 }).lean();
    res.json(employees.map(serializeEmployee));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ CREATE EMPLOYEE (Allowed for Admin AND Employer)
router.post('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, companyName,
      address, payMethod, payType, hourlyRate, salaryAmount,
      payFrequency, startDate, filingStatus, federalWithholdingRate, stateWithholdingRate
    } = req.body || {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName, email required' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email exists' });

    // Determine Employer ID
    let employerId = null;
    let finalCompanyName = companyName || '';

    if (req.user.role === 'employer') {
      employerId = req.user.id; // Force link to logged-in employer
      // Optional: fetch employer details to get company name if needed
    } else if (req.body.employerId) {
      employerId = req.body.employerId; // Admin can specify
    }

    // Auto-generate Password
    const tempPassword = Math.random().toString(36).slice(-8) + "!";
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newEmp = await Employee.create({
      employer: employerId,
      firstName, lastName, email, phone: phone || '',
      role: 'employee',
      companyName: finalCompanyName,
      passwordHash,
      address: address || {},
      payMethod: payMethod || 'direct_deposit',
      payType: payType || 'hourly',
      hourlyRate: hourlyRate || 0,
      salaryAmount: salaryAmount || 0,
      payFrequency: payFrequency || 'biweekly',
      startDate: startDate ? new Date(startDate) : Date.now(),
      filingStatus: filingStatus || 'single',
      federalWithholdingRate: federalWithholdingRate || 0,
      stateWithholdingRate: stateWithholdingRate || 0,
    });

    // Send Welcome Email
    await klaviyoService.sendWelcomeEvent(newEmp, tempPassword);

    res.status(201).json({ 
      employee: serializeEmployee(newEmp),
      message: "Employee created. Welcome email sent." 
    });

  } catch (err) {
    console.error('Create Employee Error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ✅ UPDATE EMPLOYEE (Admin or Owner Employer)
router.patch('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });

    // Security: If employer, ensure they own this employee
    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    Object.assign(emp, req.body);
    await emp.save();
    res.json({ employee: serializeEmployee(emp) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ DELETE EMPLOYEE (Admin or Owner Employer)
router.delete('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });

    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
