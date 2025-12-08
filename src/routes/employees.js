// src/routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun'); 
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
    payType: emp.payType,
    hourlyRate: emp.hourlyRate,
    salaryAmount: emp.salaryAmount,
    status: emp.status,
    invitationToken: emp.invitationToken ? 'Pending Invite' : null,
    createdAt: emp.createdAt,
    requiresPasswordChange: emp.requiresPasswordChange, 
  };
}

// src/routes/employees.js
// ... (imports and serializeEmployee function remain the same) ...

// ==============================================================================
//  SELF-ONBOARDING ROUTES
// ==============================================================================

// 1. INVITE EMPLOYEE (Employer initiates)
router.post('/invite', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const employer = await Employee.findById(req.user.id);
    
    // ✅ FIX: Allow 1 Employee
    if (employer && employer.isSelfEmployed) {
        // Count how many employees this self-employed user has linked to their ID.
        // Since a solo client is also their own employee, the count will be 1 
        // (if they view themselves as the employee) or 0 (if they only exist as employer).
        // Let's assume the solo client is the employer and their employees linked via `employer` field.
        const employeeCount = await Employee.countDocuments({ employer: req.user.id });
        
        if (employeeCount >= 1) { // If the count is 1 or more, they already have one employee (or more).
            return res.status(403).json({ error: "Self-Employed accounts are restricted to managing only one additional employee." });
        }
    }

    const { firstName, lastName, email, payRate, payType, hireDate } = req.body;
    if (!email || !firstName || !lastName) return res.status(400).json({ error: "Name and Email are required" });
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: "Employee email already exists" });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tempPass = await bcrypt.hash(inviteToken, 10); 

    const newEmp = await Employee.create({
      employer: req.user.id,
      firstName, lastName, email, role: 'employee', status: 'invited', onboardingCompleted: false, invitationToken: inviteToken, passwordHash: tempPass, requiresPasswordChange: false,
      payType: payType || 'hourly', hourlyRate: (payType === 'hourly') ? payRate : 0, salaryAmount: (payType === 'salary') ? payRate : 0, hireDate: hireDate || Date.now()
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://nwfpayroll.com'; 
    const onboardLink = `${frontendUrl}/setup-account.html?token=${inviteToken}`;
    
    if (klaviyoService && klaviyoService.sendInvite) {
        await klaviyoService.sendInvite(newEmp, onboardLink);
    }
    
    res.status(201).json({ message: "Invitation sent successfully", link: onboardLink, employee: serializeEmployee(newEmp) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ... (onboard routes remain the same) ...

// ==============================================================================
//  STANDARD CRUD & DETAIL ROUTES
// ==============================================================================

// ... (GET /:employeeId/payroll-runs remains the same) ...
// ... (LIST EMPLOYEES / remains the same) ...
// ... (GET SINGLE EMPLOYEE /:id remains the same) ...


// MANUAL CREATE EMPLOYEE
router.post('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const employer = await Employee.findById(req.user.id);
    
    // ✅ FIX: Allow 1 Employee
    if (employer && employer.isSelfEmployed) {
        // Count how many employees this self-employed user has linked to their ID.
        const employeeCount = await Employee.countDocuments({ employer: req.user.id });
        
        if (employeeCount >= 1) { // If the count is 1 or more, they already have one employee (or more).
            return res.status(403).json({ error: "Self-Employed accounts are restricted to managing only one additional employee." });
        }
    }
    
    const { firstName, lastName, email, phone, ssn, dob, gender, address, companyName, hireDate, startDate, status, payMethod, payType, payRate, payFrequency, hourlyRate, salaryAmount, federalStatus, stateStatus, filingStatus, dependentsAmount, extraWithholding, hasRetirementPlan, federalWithholdingRate, stateWithholdingRate, bankName, bankType, routingNumber, accountNumber } = req.body || {};

    if (!firstName || !lastName || !email) return res.status(400).json({ error: 'firstName, lastName, email required' });

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email exists' });

    let employerId = req.user.role === 'employer' ? req.user.id : req.body.employerId || null;
    let finalCompanyName = companyName || '';
    
    const tempPassword = Math.random().toString(36).slice(-8) + "1!";
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    let finalHourly = payType === 'hourly' ? (payRate || hourlyRate || 0) : 0;
    let finalSalary = payType === 'salary' ? (payRate || salaryAmount || 0) : 0;

    const newEmp = await Employee.create({
      employer: employerId, firstName, lastName, email, phone, role: 'employee', companyName: finalCompanyName, passwordHash, requiresPasswordChange: true, address, ssn, dob, gender,
      startDate: hireDate ? new Date(hireDate) : (startDate ? new Date(startDate) : Date.now()), status: status || 'Active', payMethod: payMethod || 'direct_deposit',
      payType: payType || 'hourly', hourlyRate: finalHourly, salaryAmount: finalSalary, payFrequency: payFrequency || 'biweekly',
      filingStatus: federalStatus || filingStatus || 'Single', stateFilingStatus: stateFilingStatus || 'Single', federalWithholdingRate: federalWithholdingRate || 0, stateWithholdingRate: stateWithholdingRate || 0,
      dependentsAmount: dependentsAmount || 0, extraWithholding: extraWithholding || 0, hasRetirementPlan: !!hasRetirementPlan, bankName, routingNumber, accountNumber
    });

    if (klaviyoService && klaviyoService.sendWelcomeEvent) { await klaviyoService.sendWelcomeEvent(newEmp, tempPassword); }

    res.status(201).json({ employee: serializeEmployee(newEmp), tempPassword: tempPassword, message: "Employee created. Welcome email sent." });

  } catch (err) {
    console.error('Create Employee Error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ... (UPDATE EMPLOYEE and DELETE EMPLOYEE remain the same) ...

module.exports = router;
