const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Employee = require('../models/Employee'); 
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');
const klaviyoService = require('../services/klaviyoService'); // ✅ Import the Service

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      employerId: user._id.toString(),
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function generateExternalEmployeeId() {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `EMP_${rand}`;
}

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

/**
 * Public Employer Registration
 */
router.post('/register', async (req, res) => {
  await handleEmployerCreation(req, res);
});

// =============================================================================
// PROTECTED ROUTES (Requires Login)
// =============================================================================
router.use(requireAuth);

// -----------------------------------------------------------------------------
// ADMIN ROUTES (Manage Employers)
// -----------------------------------------------------------------------------

/**
 * POST /api/employers/signup (Admin creating an Employer)
 */
router.post('/signup', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  await handleEmployerCreation(req, res);
});

/**
 * GET /api/employers (Admin listing all Employers)
 */
router.get('/', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  try {
    const employers = await Employee.find({ role: 'employer' }).sort({ createdAt: -1 }).lean();
    res.json(employers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/pending (Verification Queue)
 */
router.get('/pending', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  try {
    const pending = await Employee.find({ 
      role: 'employer', 
      $or: [{ status: 'pending' }, { verificationStatus: 'pending' }]
    }).lean();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  try {
    await Employee.findByIdAndUpdate(req.params.id, { status: 'active', verificationStatus: 'verified' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  try {
    await Employee.findByIdAndUpdate(req.params.id, { status: 'rejected', verificationStatus: 'rejected' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// EMPLOYER ROUTES (Manage Self & Employees)
// -----------------------------------------------------------------------------

router.get('/me', async (req, res) => {
  res.json({
    id: req.user._id,
    companyName: req.user.companyName,
    email: req.user.email,
    addressLine1: req.user.address?.line1,
    city: req.user.address?.city,
    state: req.user.address?.state,
    zip: req.user.address?.zip,
  });
});

/**
 * GET /api/employers/me/employees
 */
router.get('/me/employees', async (req, res) => {
  try {
    const employees = await Employee.find({ employer: req.user._id, role: 'employee' }).sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/employers/me/employees
 * Create a new employee & Optionally Trigger Klaviyo Email
 */
router.post('/me/employees', async (req, res) => {
  try {
    const { firstName, lastName, email, sendOnboardingEmail, ...otherData } = req.body;
    
    // 1. Check for duplicates
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    // 2. Generate a secure random temp password
    const tempPass = Math.random().toString(36).slice(-8) + "!1Aa";
    const hash = await bcrypt.hash(tempPass, 10);

    // 3. Create the Employee Record
    const newEmp = await Employee.create({
      ...otherData,
      firstName,
      lastName,
      email,
      employer: req.user._id,
      role: 'employee',
      passwordHash: hash,
      externalEmployeeId: generateExternalEmployeeId()
    });

    // 4. ⚡️ TRIGGER KLAVIYO EMAIL (If checkbox was yes)
    if (sendOnboardingEmail) {
      console.log(`📨 Triggering onboarding email for ${email}...`);
      
      const loginUrl = "https://www.nwfpayroll.com/employee/employee-login.html"; 
      
      // Fire and forget (do not await, so UI is fast)
      klaviyoService.sendOnboardingEmail(email, firstName, tempPass, loginUrl)
        .catch(err => console.error("Background Email Error:", err.message));
    }

    res.json(newEmp);
  } catch (err) {
    console.error("Create Employee Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/payroll-runs
 */
router.get('/me/payroll-runs', async (req, res) => {
  try {
    const runs = await PayrollRun.find({ employer: req.user._id })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .lean();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/me/paystubs
 */
router.get('/me/paystubs', async (req, res) => {
  try {
    const employees = await Employee.find({ employer: req.user._id, role: 'employee' }).select('_id');
    const employeeIds = employees.map((e) => e._id);

    if (!employeeIds.length) return res.json([]);

    const paystubs = await Paystub.find({ employee: { $in: employeeIds } })
      .populate('employee')
      .sort({ payDate: -1, createdAt: -1 })
      .lean();

    res.json(paystubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// HELPER: Shared Creation Logic
// -----------------------------------------------------------------------------
async function handleEmployerCreation(req, res) {
  try {
    const {
      firstName, lastName, email, password, companyName, 
      phone, ein, addressLine1, addressLine2, city, state, zip
    } = req.body;

    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already used' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const externalEmployeeId = generateExternalEmployeeId();

    const employer = await Employee.create({
      role: 'employer',
      status: 'pending',
      verificationStatus: 'pending',
      externalEmployeeId,
      firstName,
      lastName,
      email,
      phone,
      companyName,
      ein,
      address: {
        line1: addressLine1,
        line2: addressLine2,
        city,
        state,
        zip
      },
      passwordHash
    });

    const token = signToken(employer);

    res.status(201).json({
      token,
      user: {
        id: employer._id,
        email: employer.email,
        role: 'employer',
        companyName: employer.companyName
      }
    });
  } catch (err) {
    console.error('Employer Create Error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = router;
