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
 */
function generateTempPassword() {
  // Example: NwfEmp-AB12cd!
  const rand = Math.random().toString(36).slice(2, 8); // 6 chars
  return `NwfEmp-${rand}!`;
}

/**
 * POST /api/admin/employers
 * Admin creates a new employer account.
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
      ein,
      address,
      documents,
      customPassword,
    } = req.body || {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'firstName, lastName, and email are required',
      });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ error: 'An account already exists with this email' });
    }

    // Generate password
    const plainPassword = customPassword || generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // ✅ FIX: Generate a unique ID to prevent "duplicate key" error
    const uniqueId = 'EMP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const employer = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'employer',
      companyName: companyName || '',
      ein: ein || '',
      address: address || {},
      documents: documents || [],
      externalEmployeeId: uniqueId // Forces a unique value
    });

    res.status(201).json({
      employer: {
        id: employer._id,
        firstName: employer.firstName,
        lastName: employer.lastName,
        email: employer.email,
        role: employer.role,
        companyName: employer.companyName,
      },
      tempPassword: plainPassword,
      message: 'Employer created successfully.',
    });
  } catch (err) {
    console.error('POST /api/admin/employers error:', err);
    res.status(500).json({ error: err.message || 'Failed to create employer' });
  }
});

module.exports = router;
