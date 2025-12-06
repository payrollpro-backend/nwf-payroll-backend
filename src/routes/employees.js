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
    // 1. Destructure ALL fields sent from the new detailed frontend form
    const {
      // Identity
      firstName, lastName, middleName, suffix, email, phone, 
      ssn, dob, gender, address,
      
      // Employment
      companyName, hireDate, startDate, status, employmentType,
      isOfficer, isContractor, isStatutory,
      
      // Pay
      payMethod, payType, payRate, payFrequency,
      hourlyRate, salaryAmount, // Fallbacks
      
      // Tax
      federalStatus, stateStatus, filingStatus, 
      dependentsAmount, extraWithholding, hasRetirementPlan,
      federalWithholdingRate, stateWithholdingRate,
      
      // Bank
      bankName, bankType, routingNumber, accountNumber
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
      employerId = req.user.id; 
    } else if (req.body.employerId) {
      employerId = req.body.employerId;
    }

    // 2. Auto-generate Password
    const tempPassword = Math.random().toString(36).slice(-8) + "1!";
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // 3. Logic to handle "Pay Rate" vs Hourly/Salary
    let finalHourly = 0;
    let finalSalary = 0;
    
    // The frontend sends generic 'payRate'. We assign it based on payType.
    if (payRate) {
      if (payType === 'salary') finalSalary = parseFloat(payRate);
      else finalHourly = parseFloat(payRate);
    } else {
      // Fallback if old API used
      finalHourly = hourlyRate || 0;
      finalSalary = salaryAmount || 0;
    }

    // 4. Create Employee with ALL fields
    const newEmp = await Employee.create({
      employer: employerId,
      firstName, lastName, middleName, suffix, 
      email, phone: phone || '',
      role: 'employee',
      companyName: finalCompanyName,
      passwordHash,
      address: address || {},
      
      // Identity
      ssn, dob, gender,
      
      // Employment
      startDate: hireDate ? new Date(hireDate) : (startDate ? new Date(startDate) : Date.now()),
      status: status || 'Active', // Default Active
      employmentType: employmentType || 'Full Time',
      isOfficer: !!isOfficer,
      isContractor: !!isContractor,
      isStatutory: !!isStatutory,

      // Pay
      payMethod: payMethod || 'direct_deposit',
      payType: payType || 'hourly',
      hourlyRate: finalHourly,
      salaryAmount: finalSalary,
      payFrequency: payFrequency || 'biweekly',
      
      // Tax Settings
      filingStatus: federalStatus || filingStatus || 'Single',
      stateFilingStatus: stateStatus || 'Single', // Assuming you have this field in model
      federalWithholdingRate: federalWithholdingRate || 0,
      stateWithholdingRate: stateWithholdingRate || 0,
      dependentsAmount: dependentsAmount || 0,
      extraWithholding: extraWithholding || 0,
      hasRetirementPlan: !!hasRetirementPlan,
      
      // Banking
      bankName, bankType, routingNumber, accountNumber
    });

    // Send Welcome Email
    if (klaviyoService && klaviyoService.sendWelcomeEvent) {
       await klaviyoService.sendWelcomeEvent(newEmp, tempPassword);
    }

    // 5. Send Response WITH tempPassword
    res.status(201).json({ 
      employee: serializeEmployee(newEmp),
      tempPassword: tempPassword, // <--- THIS IS THE FIX
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

    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Allow updating all the fields we allow in Create
    Object.assign(emp, req.body);
    
    // Recalculate rates if payType changed during update
    if (req.body.payRate !== undefined) {
       if (emp.payType === 'salary') {
         emp.salaryAmount = req.body.payRate;
         emp.hourlyRate = 0;
       } else {
         emp.hourlyRate = req.body.payRate;
         emp.salaryAmount = 0;
       }
    }

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
