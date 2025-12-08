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

// ==============================================================================
//  SELF-ONBOARDING ROUTES
// ==============================================================================

// 1. INVITE EMPLOYEE (Employer initiates)
router.post('/invite', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const employer = await Employee.findById(req.user.id);
    // ✅ NEW CHECK: Block self-employed from inviting others
    if (employer.isSelfEmployed) {
        return res.status(403).json({ error: "Self-Employed accounts cannot add other employees." });
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

// 2. VERIFY TOKEN
router.get('/onboard/:token', async (req, res) => {
    try {
        const emp = await Employee.findOne({ invitationToken: req.params.token });
        if (!emp) return res.status(404).json({ error: "Invalid or expired link" });
        res.json({ email: emp.email, firstName: emp.firstName, lastName: emp.lastName });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. COMPLETE SETUP
router.post('/onboard/complete', async (req, res) => {
    try {
        const { token, password, ssn, dob, phone, gender, address, bankName, routingNumber, accountNumber, accountType, filingStatus, stateFilingStatus } = req.body;
        const emp = await Employee.findOne({ invitationToken: token });
        if (!emp) return res.status(400).json({ error: "Invalid or expired token" });

        const hashedPassword = await bcrypt.hash(password, 10);

        emp.passwordHash = hashedPassword;
        emp.requiresPasswordChange = false;
        emp.phone = phone; emp.ssn = ssn; emp.dob = dob; emp.gender = gender; emp.address = address; 
        emp.directDeposit = { bankName, routingNumber, accountNumber, accountNumberLast4: accountNumber.slice(-4), accountType: accountType || 'Checking' };
        emp.filingStatus = filingStatus || 'single'; emp.stateFilingStatus = stateFilingStatus || 'single';
        emp.invitationToken = null; emp.onboardingCompleted = true; emp.status = 'active';

        await emp.save();
        res.json({ success: true, message: "Account setup complete! You can now log in." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==============================================================================
//  STANDARD CRUD & DETAIL ROUTES
// ==============================================================================

// GET ALL PAYROLL RUNS FOR A SINGLE EMPLOYEE
router.get('/:employeeId/payroll-runs', requireAuth(['admin', 'employer']), async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        // Security check: If employer, ensure they own this employee
        if (req.user.role === 'employer' && String(req.user.id) !== (await Employee.findById(employeeId)).employer.toString()) {
             return res.status(403).json({ error: 'Forbidden' });
        }

        const runs = await PayrollRun.find({ employee: employeeId })
            .sort({ payDate: -1, createdAt: -1 })
            .lean();
            
        res.json(runs);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LIST EMPLOYEES
router.get('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'employer') {
      query.employer = req.user.id;
      // ✅ NEW CHECK: If self-employed, only list *their* employee record (which is them)
      const employer = await Employee.findById(req.user.id);
      if (employer.isSelfEmployed) {
          query._id = req.user.id; // Restrict list to their own ID
      }
    }
    const employees = await Employee.find(query).sort({ createdAt: -1 }).lean();
    res.json(employees.map(serializeEmployee));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET SINGLE EMPLOYEE
router.get('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(emp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// MANUAL CREATE EMPLOYEE
router.post('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const employer = await Employee.findById(req.user.id);
    // ✅ NEW CHECK: Block self-employed from manually creating others
    if (employer.isSelfEmployed) {
        return res.status(403).json({ error: "Self-Employed accounts cannot add other employees." });
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
      filingStatus: federalStatus || filingStatus || 'Single', stateFilingStatus: stateStatus || 'Single', federalWithholdingRate: federalWithholdingRate || 0, stateWithholdingRate: stateWithholdingRate || 0,
      dependentsAmount: dependentsAmount || 0, extraWithholding: extraWithholding || 0, hasRetirementPlan: !!hasRetirementPlan, bankName, routingNumber, accountNumber
    });

    if (klaviyoService && klaviyoService.sendWelcomeEvent) { await klaviyoService.sendWelcomeEvent(newEmp, tempPassword); }

    res.status(201).json({ employee: serializeEmployee(newEmp), tempPassword: tempPassword, message: "Employee created. Welcome email sent." });

  } catch (err) {
    console.error('Create Employee Error:', err);
    res.status(400).json({ error: err.message });
  }
});

// UPDATE EMPLOYEE
router.patch('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    Object.assign(emp, req.body);
    
    if (req.body.payRate !== undefined) {
       if (emp.payType === 'salary') { emp.salaryAmount = req.body.payRate; emp.hourlyRate = 0; } 
       else { emp.hourlyRate = req.body.payRate; emp.salaryAmount = 0; }
    }

    await emp.save();
    res.json({ employee: serializeEmployee(emp) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE EMPLOYEE
router.delete('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'employer' && String(emp.employer) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
