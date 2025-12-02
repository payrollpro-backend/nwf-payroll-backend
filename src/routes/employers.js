// src/routes/employers.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Employee = require('../models/Employee'); // We store Employers in the Employee collection
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

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
 * POST /api/employers/register (Public Signup)
 * Used by the public registration page
 */
router.post('/register', async (req, res) => {
  await handleEmployerCreation(req, res);
});

// =============================================================================
// PROTECTED ROUTES (Admin & Employer)
// =============================================================================
router.use(requireAuth);

/**
 * POST /api/employers/signup (Admin Create)
 * Used by the Admin "Create Employer" page
 */
router.post('/signup', async (req, res) => {
  // Only admins should use this specific route, but logic is same as register
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }
  await handleEmployerCreation(req, res);
});

/**
 * GET /api/employers (Admin List)
 * Used by Admin Dashboard -> Employers Tab
 */
router.get('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }

  try {
    // Fetch all users with role 'employer'
    const employers = await Employee.find({ role: 'employer' })
      .sort({ createdAt: -1 })
      .lean();
    res.json(employers);
  } catch (err) {
    console.error('GET /employers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/pending (Verification)
 * Used by Admin Dashboard -> Verification Tab
 */
router.get('/pending', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }

  try {
    // Assuming 'status' field exists, or we check verificationStatus
    // If you don't have a status field yet, this might return empty.
    const pending = await Employee.find({ 
      role: 'employer', 
      $or: [{ status: 'pending' }, { verificationStatus: 'pending' }]
    }).lean();
    
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/employers/:id/approve (Verification Action)
 */
router.post('/:id/approve', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  try {
    await Employee.findByIdAndUpdate(req.params.id, { 
      status: 'active', 
      verificationStatus: 'verified' 
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/employers/:id/reject (Verification Action)
 */
router.post('/:id/reject', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  try {
    await Employee.findByIdAndUpdate(req.params.id, { 
      status: 'rejected', 
      verificationStatus: 'rejected' 
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// EMPLOYER PROFILE & MANAGEMENT (/me routes)
// =============================================================================

router.get('/me', async (req, res) => {
  // Return current employer profile
  res.json({
    id: req.user._id,
    companyName: req.user.companyName,
    email: req.user.email,
    // ... map other fields as needed
  });
});

router.get('/me/employees', async (req, res) => {
  try {
    const employees = await Employee.find({ employer: req.user._id, role: 'employee' }).sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/me/employees', async (req, res) => {
  // Logic to add an employee (same as your previous file)
  try {
    const { firstName, lastName, email, ...otherData } = req.body;
    
    // Check dupe
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    // Temp password
    const tempPass = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(tempPass, 10);

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

    res.json(newEmp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// SHARED HELPER: Handle Creation Logic
// =============================================================================
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
      status: 'pending', // Default to pending so it shows in verification
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
