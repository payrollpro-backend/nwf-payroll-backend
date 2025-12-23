// src/routes/employees.js
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const { requireAuth } = require('../middleware/auth');
const klaviyoService = require('../services/klaviyoService');

// -------------------------
// Helpers
// -------------------------
function normalizeFilingStatus(value) {
  if (!value) return 'single';
  const v = String(value).trim().toLowerCase();

  if (['single', 's', 'single_or_married_filing_separately', 'married_filing_separately', 'mfs'].includes(v)) return 'single';
  if (['married', 'mfj', 'married_filing_jointly', 'married filing jointly'].includes(v)) return 'married';
  if (['head_of_household', 'head of household', 'hoh', 'head'].includes(v)) return 'head_of_household';

  const cleaned = v.replace(/\s+/g, '_');
  if (['single', 'married', 'head_of_household'].includes(cleaned)) return cleaned;

  return 'single';
}

// IMPORTANT:
// Your current Employee model (as uploaded) still has salaryAmount.
// To keep everything working NOW (and also after you add annualSalary/payRate later),
// we compute and dual-map:
// - annualSalary/payRate (preferred) <-> salaryAmount (legacy storage)
function getAnnualSalaryFromEmp(emp) {
  const n =
    emp?.annualSalary ??
    emp?.payRate ??
    emp?.salaryAmount ??
    0;
  return Number(n) || 0;
}

function serializeEmployee(emp) {
  const annual = getAnnualSalaryFromEmp(emp);
  return {
    _id: emp._id,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    phone: emp.phone || '',
    role: emp.role,
    companyName: emp.companyName || '',

    payType: emp.payType,
    hourlyRate: emp.hourlyRate || 0,

    // NEW standard fields (frontend reads these)
    annualSalary: annual,
    payRate: annual,

    // legacy field (kept for compatibility if other code still uses it)
    salaryAmount: emp.salaryAmount || 0,

    payFrequency: emp.payFrequency || 'biweekly',

    status: emp.status,
    invitationToken: emp.invitationToken ? 'Pending Invite' : null,
    createdAt: emp.createdAt,
    requiresPasswordChange: emp.requiresPasswordChange,
    address: emp.address || {},
    directDeposit: emp.directDeposit || {},
    businessWithdrawalAccount: emp.businessWithdrawalAccount || {},
    filingStatus: emp.filingStatus,
    stateFilingStatus: emp.stateFilingStatus
  };
}

// ==============================================================================
//  SELF-ONBOARDING ROUTES
// ==============================================================================

// 1) INVITE EMPLOYEE
router.post('/invite', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const employer = await Employee.findById(req.user.id);

    // Self-employed restriction (1 employee max)
    if (employer && employer.isSelfEmployed) {
      const employeeCount = await Employee.countDocuments({ employer: req.user.id });
      if (employeeCount >= 1) {
        return res.status(403).json({ error: "Self-Employed accounts are restricted to managing only one additional employee." });
      }
    }

    const { firstName, lastName, email, payRate, payType, hireDate } = req.body;
    if (!email || !firstName || !lastName) return res.status(400).json({ error: "Name and Email are required" });

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: "Employee email already exists" });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tempPass = await bcrypt.hash(inviteToken, 10);

    const annual = (payType === 'salary') ? (Number(payRate) || 0) : 0;
    const hourly = (payType === 'hourly') ? (Number(payRate) || 0) : 0;

    const newEmp = await Employee.create({
      employer: req.user.id,
      firstName,
      lastName,
      email,
      role: 'employee',
      status: 'invited',
      onboardingCompleted: false,
      invitationToken: inviteToken,
      passwordHash: tempPass,
      requiresPasswordChange: false,

      payType: payType || 'hourly',
      hourlyRate: hourly,

      // Store in legacy field (current schema), but also keep forward fields if schema later adds them
      salaryAmount: annual,
      annualSalary: annual,
      payRate: annual,

      hireDate: hireDate || Date.now()
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://nwfpayroll.com';
    const onboardLink = `${frontendUrl}/setup-account.html?token=${inviteToken}`;

    if (klaviyoService && klaviyoService.sendInvite) {
      await klaviyoService.sendInvite(newEmp, onboardLink);
    }

    res.status(201).json({
      message: "Invitation sent successfully",
      link: onboardLink,
      employee: serializeEmployee(newEmp)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2) VERIFY TOKEN
router.get('/onboard/:token', async (req, res) => {
  try {
    const emp = await Employee.findOne({ invitationToken: req.params.token });
    if (!emp) return res.status(404).json({ error: "Invalid or expired link" });
    res.json({ email: emp.email, firstName: emp.firstName, lastName: emp.lastName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3) COMPLETE SETUP
router.post('/onboard/complete', async (req, res) => {
  try {
    const {
      token, password, ssn, dob, phone, gender, address,
      bankName, routingNumber, accountNumber, accountType,
      filingStatus, stateFilingStatus
    } = req.body;

    const emp = await Employee.findOne({ invitationToken: token });
    if (!emp) return res.status(400).json({ error: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(password, 10);

    emp.passwordHash = hashedPassword;
    emp.requiresPasswordChange = false;

    emp.phone = phone;
    emp.ssn = ssn;
    emp.dob = dob;
    emp.gender = gender;
    emp.address = address;

    emp.directDeposit = {
      bankName,
      routingNumber,
      accountNumber,
      accountNumberLast4: (accountNumber ? String(accountNumber).slice(-4) : ''),
      accountType: accountType || 'Checking'
    };

    emp.filingStatus = normalizeFilingStatus(filingStatus);
    emp.stateFilingStatus = normalizeFilingStatus(stateFilingStatus);

    emp.invitationToken = null;
    emp.onboardingCompleted = true;
    emp.status = 'active';

    await emp.save();
    res.json({ success: true, message: "Account setup complete! You can now log in." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
//  STANDARD ROUTES
// ==============================================================================

// GET ALL PAYROLL RUNS FOR A SINGLE EMPLOYEE
router.get('/:employeeId/payroll-runs', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Security check: If employer, ensure they own this employee
    if (req.user.role === 'employer') {
      const target = await Employee.findById(employeeId);
      if (!target) return res.status(404).json({ error: 'Employee not found' });
      if (String(target.employer) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
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

    if (req.user.role === 'admin') {
      query.role = 'employee';
    } else if (req.user.role === 'employer') {
      const employer = await Employee.findById(req.user.id);

      if (employer && employer.isSelfEmployed) {
        query._id = req.user.id; // solo sees only self
      } else {
        query.employer = req.user.id;
      }
    }

    const employees = await Employee.find(query).sort({ createdAt: -1 }).lean();
    res.json(employees.map(serializeEmployee));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE EMPLOYEE
router.get('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const requester = await Employee.findById(req.user.id);

    if (requester.role === 'employer') {
      if (requester.isSelfEmployed) {
        if (String(emp._id) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
      } else if (String(emp.employer) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MANUAL CREATE EMPLOYEE
router.post('/', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const employer = await Employee.findById(req.user.id);

    if (employer && employer.isSelfEmployed) {
      const employeeCount = await Employee.countDocuments({ employer: req.user.id });
      if (employeeCount >= 1) {
        return res.status(403).json({ error: "Self-Employed accounts are restricted to managing only one additional employee." });
      }
    }

    const {
      firstName, lastName, email, phone, ssn, dob, gender, address, companyName,
      hireDate, startDate, status, payMethod, payType, payRate, payFrequency,
      hourlyRate, salaryAmount, annualSalary,
      federalStatus, stateStatus, filingStatus, stateFilingStatus,
      dependentsAmount, extraWithholding, hasRetirementPlan,
      federalWithholdingRate, stateWithholdingRate,
      bankName, bankType, routingNumber, accountNumber
    } = req.body || {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName, email required' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email exists' });

    const employerId = req.user.role === 'employer' ? req.user.id : (req.body.employerId || null);
    const finalCompanyName = companyName || '';

    // Self-employed fallback salary (legacy salaryAmount)
    let defaultAnnual = 0;
    if (employer && employer.isSelfEmployed) {
      defaultAnnual = getAnnualSalaryFromEmp(employer);
    }

    const tempPassword = Math.random().toString(36).slice(-8) + "1!";
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const defaultAddress = address || { line1: '', city: '', state: '', zip: '' };
    const defaultDirectDeposit = {
      bankName: '',
      routingNumber: '',
      accountNumber: '',
      accountNumberLast4: ''
    };

    const finalPayType = payType || 'hourly';

    const finalHourly = finalPayType === 'hourly'
      ? (Number(payRate) || Number(hourlyRate) || 0)
      : 0;

    const annualIn = Number(annualSalary) || Number(payRate) || Number(salaryAmount) || defaultAnnual || 0;
    const finalAnnual = finalPayType === 'salary' ? annualIn : 0;

    const finalState = normalizeFilingStatus(stateFilingStatus || stateStatus);
    const finalFederal = normalizeFilingStatus(federalStatus || filingStatus);

    const newEmp = await Employee.create({
      employer: employerId,
      firstName,
      lastName,
      email,
      phone,
      role: 'employee',
      companyName: finalCompanyName,
      passwordHash,
      requiresPasswordChange: true,

      address: defaultAddress,
      directDeposit: defaultDirectDeposit,

      ssn,
      dob,
      gender,

      startDate: hireDate ? new Date(hireDate) : (startDate ? new Date(startDate) : Date.now()),
      status: status || 'Active',
      payMethod: payMethod || 'direct_deposit',

      payType: finalPayType,
      hourlyRate: finalHourly,

      // legacy + forward
      salaryAmount: finalAnnual,
      annualSalary: finalAnnual,
      payRate: finalAnnual,

      payFrequency: payFrequency || 'biweekly',

      filingStatus: finalFederal,
      stateFilingStatus: finalState,

      federalWithholdingRate: federalWithholdingRate || 0,
      stateWithholdingRate: stateWithholdingRate || 0,
      dependentsAmount: dependentsAmount || 0,
      extraWithholding: extraWithholding || 0,
      hasRetirementPlan: !!hasRetirementPlan,

      // legacy top-level banking fields (kept if you still use them anywhere)
      bankName,
      routingNumber,
      accountNumber
    });

    if (klaviyoService && klaviyoService.sendWelcomeEvent) {
      await klaviyoService.sendWelcomeEvent(newEmp, tempPassword);
    }

    res.status(201).json({
      employee: serializeEmployee(newEmp),
      tempPassword,
      message: "Employee created. Welcome email sent."
    });
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

    const requester = await Employee.findById(req.user.id);

    // Security
    if (requester.role === 'employer') {
      if (requester.isSelfEmployed && String(emp._id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Self-Employed accounts can only update their own profile.' });
      } else if (!requester.isSelfEmployed && String(emp.employer) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const b = { ...(req.body || {}) };

    // Block role/solo changes
    delete b.isSelfEmployed;
    delete b.role;

    // Block SSN edits via employer portal updates (safer)
    delete b.ssn;
    delete b.ssnLast4;

    // Merge nested objects safely
    if (b.address) {
      emp.address = { ...emp.address, ...b.address };
      delete b.address;
    }

    if (b.directDeposit) {
      emp.directDeposit = { ...emp.directDeposit, ...b.directDeposit };
      if (b.directDeposit.accountNumber) {
        emp.directDeposit.accountNumberLast4 = String(b.directDeposit.accountNumber).slice(-4);
      }
      delete b.directDeposit;
    }

    if (b.businessWithdrawalAccount) {
      emp.businessWithdrawalAccount = { ...emp.businessWithdrawalAccount, ...b.businessWithdrawalAccount };
      delete b.businessWithdrawalAccount;
    }

    // Normalize filing statuses (accept multiple client keys)
    if (b.filingStatus || b.federalStatus) {
      emp.filingStatus = normalizeFilingStatus(b.filingStatus || b.federalStatus);
      delete b.federalStatus;
      delete b.filingStatus;
    }
    if (b.stateFilingStatus || b.stateStatus) {
      emp.stateFilingStatus = normalizeFilingStatus(b.stateFilingStatus || b.stateStatus);
      delete b.stateStatus;
      delete b.stateFilingStatus;
    }

    // Salary standardization:
    // Accept annualSalary OR payRate from client, and sync into legacy salaryAmount.
    // (This keeps payroll correct even before you update the schema.)
    if (b.annualSalary !== undefined || b.payRate !== undefined) {
      const annual = Number(b.annualSalary ?? b.payRate ?? 0) || 0;

      // forward fields (won't persist until schema adds them, but harmless)
      emp.annualSalary = annual;
      emp.payRate = annual;

      // legacy storage (CURRENT schema)
      emp.salaryAmount = annual;

      delete b.annualSalary;
      delete b.payRate;
      delete b.salaryAmount;
    } else {
      // prevent someone from pushing salaryAmount directly
      delete b.salaryAmount;
    }

    // Hourly updates
    if (b.hourlyRate !== undefined) {
      emp.hourlyRate = Number(b.hourlyRate) || 0;
      delete b.hourlyRate;
    }

    // Apply remaining flat fields
    Object.assign(emp, b);

    await emp.save();
    res.json({ employee: serializeEmployee(emp) });
  } catch (err) {
    console.error('Profile Update Save Error:', err);
    res.status(500).json({ error: `Update failed. Details: ${err.message}` });
  }
});

// DELETE EMPLOYEE
router.delete('/:id', requireAuth(['admin', 'employer']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });

    const requester = await Employee.findById(req.user.id);

    if (requester.role === 'employer') {
      if (requester.isSelfEmployed) {
        return res.status(403).json({ error: 'Self-Employed accounts cannot be deleted through this portal.' });
      } else if (String(emp.employer) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
