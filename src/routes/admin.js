// src/routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Only allow admins.
 */
function ensureAdmin(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return req.user;
}

router.use(requireAuth);

/**
 * POST /api/admin/employers
 * Admin creates a new employer account
 */
router.post('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  const { firstName, lastName, email, password, companyName } = req.body || {};

  if (!firstName || !lastName || !email || !password) {
    return res
      .status(400)
      .json({ error: 'firstName, lastName, email, and password are required' });
  }

  try {
    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const employer = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'employer',
      companyName: companyName || '',
      address: {}, // optional
    });

    res.status(201).json({ employer });
  } catch (err) {
    console.error('Admin create employer error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
