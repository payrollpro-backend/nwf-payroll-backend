// src/routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // Required for generating invite tokens
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
    invitationToken: emp.invitationToken ? 'Pending Invite' : null,
    createdAt: emp.createdAt,
  };
}

// ==============================================================================
//  SELF-ONBOARDING ROUTES (ADP/GUSTO STYLE)
// ==============================================================================

// ✅ 1. INVITE EMPLOYEE (Employer initiates, System sends email)
router.post('/invite', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const { firstName, lastName, email, payRate, payType, hireDate } = req.body;

    // Basic Validation
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: "Name and Email are required" });
    }

    // Check if exists
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: "Employee email already exists" });

    // Generate a Secure Token
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // Create "Shell" Employee Record
    // We set a temporary random password just to satisfy database constraints.
    // The user will overwrite this when they complete onboarding.
    const tempPass = await bcrypt.hash(inviteToken, 10); 

    const newEmp = await Employee.create({
      employer: req.user.id,
      firstName, 
      lastName, 
      email,
      role: 'employee',
      status: 'invited', // Special status
      onboardingCompleted: false,
      invitationToken: inviteToken,
      passwordHash: tempPass, 
      
      // Pay Info (Employer sets this, employee usually can't change it)
      payType: payType || 'hourly',
      hourlyRate: (payType === 'hourly') ? payRate : 0,
      salaryAmount: (payType === 'salary') ? payRate : 0,
      hireDate: hireDate || Date.now()
    });

    // Send the Email (Link to your frontend setup page)
    // Adjust domain to match your live site or localhost
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500'; 
    const onboardLink = `${frontendUrl}/setup-account.html?token=${inviteToken}`;
    
    // Call Klaviyo or Email Service
    if (klaviyoService && klaviyoService.sendInvite) {
        await klaviyoService.sendInvite(newEmp, onboardLink);
    }
    
    res.status(201).json({ 
        message: "Invitation sent successfully", 
        link: onboardLink, // Returning link for testing/debugging
        employee: serializeEmployee(newEmp)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 2. VERIFY TOKEN (Public - Used by setup page to load user name)
router.get('/onboard/:token', async (req, res) => {
    try {
        const emp = await Employee.findOne({ invitationToken: req.params.token });
        if (!emp) return res.status(404).json({ error: "Invalid or expired link" });
        
        // Return basic info so the user knows they are setting up the right account
        res.json({ 
            email: emp.email, 
            firstName: emp.firstName, 
            lastName: emp.lastName 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ 3. COMPLETE SETUP (Public - User submits Password, SSN, Bank)
router.post('/onboard/complete', async (req, res) => {
    try {
        const { 
            token, password, 
            ssn, dob, phone, gender,
            address, // { line1, city, state, zip }
            bankName, routingNumber, accountNumber, accountType,
            filingStatus, stateFilingStatus 
        } = req.body;

        // Find by Token
        const emp = await Employee.findOne({ invitationToken: token });
        if (!emp) return res.status(400).json({ error: "Invalid or expired token" });

        // Hash new password (User defined)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update Employee Record with sensitive data
        emp.passwordHash = hashedPassword;
        emp.phone = phone;
        emp.ssn = ssn;
        emp.dob = dob;
        emp.gender = gender;
        emp.address = address; 
        
        // Update Banking
        emp.directDeposit = {
            bankName,
            routingNumber,
            accountNumber, // Full number
            accountNumberLast4: accountNumber.slice(-4),
            accountType: accountType || 'Checking'
        };

        // Update Tax
        emp.filingStatus = filingStatus || 'single';
        emp.stateFilingStatus = stateFilingStatus || 'single';
        
        // Finalize
        emp.invitationToken = null; // Clear token so link cannot be used again
        emp.onboardingCompleted = true;
        emp.status = 'active';

        await emp.save();

        res.json({ success: true, message: "Account setup complete! You can now log in." });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================================================================
//  STANDARD CRUD ROUTES
// ==============================================================================

// ✅ LIST EMPLOYEES
router.get('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'employer') {
      query.employer = req.user.id;
    }
    const employees = await Employee.find(query).sort({ createdAt: -1 }).lean();
    res.json(employees.map(serializeEmployee));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET SINGLE EMPLOYEE (Fix for Edit Page)
router.get('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ MANUAL CREATE EMPLOYEE (Admin/Employer full entry)
router.post('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const {
      firstName, lastName, middleName, suffix, email, phone, 
      ssn, dob, gender, address,
      companyName, hireDate, startDate, status, employmentType,
      isOfficer, isContractor, isStatutory,
      payMethod, payType, payRate, payFrequency,
      hourlyRate, salaryAmount,
      federalStatus, stateStatus, filingStatus, 
      dependentsAmount, extraWithholding, hasRetirementPlan,
      federalWithholdingRate, stateWithholdingRate,
      bankName, bankType, routingNumber, accountNumber
    } = req.body || {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName, email required' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email exists' });

    let employerId = null;
    let finalCompanyName = companyName || '';
    if (req.user.role === 'employer') {
      employerId = req.user.id; 
    } else if (req.body.employerId) {
      employerId = req.body.employerId;
    }

    const tempPassword = Math.random().toString(36).slice(-8) + "1!";
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    let finalHourly = 0;
    let finalSalary = 0;
    if (payRate) {
      if (payType === 'salary') finalSalary = parseFloat(payRate);
      else finalHourly = parseFloat(payRate);
    } else {
      finalHourly = hourlyRate || 0;
      finalSalary = salaryAmount || 0;
    }

    const newEmp = await Employee.create({
      employer: employerId,
      firstName, lastName, middleName, suffix, 
      email, phone: phone || '',
      role: 'employee',
      companyName: finalCompanyName,
      passwordHash,
      address: address || {},
      ssn, dob, gender,
      startDate: hireDate ? new Date(hireDate) : (startDate ? new Date(startDate) : Date.now()),
      status: status || 'Active',
      employmentType: employmentType || 'Full Time',
      isOfficer: !!isOfficer,
      isContractor: !!isContractor,
      isStatutory: !!isStatutory,
      payMethod: payMethod || 'direct_deposit',
      payType: payType || 'hourly',
      hourlyRate: finalHourly,
      salaryAmount: finalSalary,
      payFrequency: payFrequency || 'biweekly',
      filingStatus: federalStatus || filingStatus || 'Single',
      stateFilingStatus: stateStatus || 'Single', 
      federalWithholdingRate: federalWithholdingRate || 0,
      stateWithholdingRate: stateWithholdingRate || 0,
      dependentsAmount: dependentsAmount || 0,
      extraWithholding: extraWithholding || 0,
      hasRetirementPlan: !!hasRetirementPlan,
      bankName, bankType, routingNumber, accountNumber
    });

    if (klaviyoService && klaviyoService.sendWelcomeEvent) {
       await klaviyoService.sendWelcomeEvent(newEmp, tempPassword);
    }

    res.status(201).json({ 
      employee: serializeEmployee(newEmp),
      tempPassword: tempPassword, 
      message: "Employee created. Welcome email sent." 
    });

  } catch (err) {
    console.error('Create Employee Error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ✅ UPDATE EMPLOYEE
router.patch('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });

    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    Object.assign(emp, req.body);
    
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

// ✅ DELETE EMPLOYEE
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
