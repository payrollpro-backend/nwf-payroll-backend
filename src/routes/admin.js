// src/routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: ensure the current user is an ADMIN
 */
function ensureAdmin(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return req.user;
}

// ✅ All /api/admin/* routes require a valid JWT with role=admin
router.use(requireAuth(['admin']));

/**
 * Helper: generate a generic / temporary password for new employers
 * Example: NwfEmp-AB12cd!
 */
function generateTempPassword() {
  const rand = Math.random().toString(36).slice(2, 8); // 6 chars
  return `NwfEmp-${rand}!`;
}

/**
 * POST /api/admin/employers
 *
 * Admin creates a new employer account.
 * Supports BOTH payload styles:
 *
 * A) Old / explicit:
 * {
 *   firstName,
 *   lastName,
 *   email,
 *   companyName,
 *   ein,
 *   address,
 *   documents,
 *   customPassword
 * }
 *
 * B) "Create Employer" page style:
 * {
 *   companyName,
 *   companyEmail,
 *   ein,
 *   address,
 *   documents,
 *   customPassword
 * }
 */
router.post('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    const {
      firstName,
      lastName,
      email,
      companyName,
      companyEmail,
      ein,
      address,
      documents,
      customPassword,
    } = req.body || {};

    // Normalize required fields so we support both shapes
    const normalizedCompanyName = (companyName || '').trim();
    const loginEmail = (email || companyEmail || '').trim().toLowerCase();

    if (!normalizedCompanyName || !loginEmail) {
      return res.status(400).json({
        error: 'companyName and email/companyEmail are required',
      });
    }

    // Contact name defaults if not provided
    const contactFirstName = firstName || normalizedCompanyName;
    const contactLastName = lastName || 'Owner';

    const existing = await Employee.findOne({ email: loginEmail });
    if (existing) {
      return res
        .status(400)
        .json({ error: 'An account already exists with this email' });
    }

    // Generate password (admin can override with customPassword)
    const plainPassword = customPassword || generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Unique ID to avoid duplicate externalEmployeeId
    const uniqueId =
      'EMP-' + Date.now() + '-' + Math.floor(Math.random() * 100000);

    const employer = await Employee.create({
      firstName: contactFirstName,
      lastName: contactLastName,
      email: loginEmail,
      passwordHash,
      role: 'employer',
      companyName: normalizedCompanyName,
      ein: ein || '',
      address: address || {},
      documents: documents || [],
      externalEmployeeId: uniqueId, // Forces a unique value
    });

    res.status(201).json({
      employer: {
        id: employer._id,
        firstName: employer.firstName,
        lastName: employer.lastName,
        email: employer.email,
        role: employer.role,
        companyName: employer.companyName,
        createdAt: employer.createdAt,
      },
      tempPassword: plainPassword,
      message:
        'Employer created successfully. Share the email + tempPassword with them to log in.',
    });
  } catch (err) {
    console.error('POST /api/admin/employers error:', err);
    res.status(500).json({ error: err.message || 'Failed to create employer' });
  }
});

/**
 * GET /api/admin/employers
 * Returns a list of all users with role="employer"
 * NOTE: still returns { employers } to match existing frontend.
 */
router.get('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    const employers = await Employee.find({ role: 'employer' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({ employers });
  } catch (err) {
    console.error('GET /api/admin/employers error:', err);
    res.status(500).json({ error: 'Failed to fetch employers' });
  }
});

module.exports = router;
