// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const router = express.Router();

// Use env secret if set, otherwise a dev fallback
const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

/**
 * Sign a JWT for a user/admin
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      employerId: user.employer ? user.employer.toString() : null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Create admin via API (optional, one-time use)
 */
router.post('/admin-register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Missing required fields', body: req.body });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'admin',
    });

    const token = signToken(admin);

    res.status(201).json({
      token,
      user: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error('admin-register error:', err);
    res.status(400).json({ error: err.message || 'Admin register failed' });
  }
});

/**
 * Login for admin/employer/employee
 * - If user has no passwordHash yet, we set it on first login with this password.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // 1) Check body
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Missing email or password', body: req.body });
    }

    // 2) Find user
    let user = await Employee.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found for this email' });
    }

    // 3) If no passwordHash yet, set it now and log them in
    if (!user.passwordHash) {
      const passwordHash = await bcrypt.hash(password, 10);
      user.passwordHash = passwordHash;

      // If this is your admin email, ensure role is admin
      if (!user.role) {
        user.role = 'admin';
      }

      await user.save();

      const token = signToken(user);
      return res.json({
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          employerId: user.employer || null,
        },
      });
    }

    // 4) If passwordHash exists, validate password normally
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        employerId: user.employer || null,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(400).json({ error: err.message || 'Login failed' });
  }
});

/**
 * Admin password reset helper
 * - If user does not exist: create them as ADMIN and set password
 * - If user exists: force role=admin and update password
 */
router.patch('/admin-reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Email and newPassword are required' });
    }

    let admin = await Employee.findOne({ email });

    if (!admin) {
      // Create new admin
      const passwordHash = await bcrypt.hash(newPassword, 10);
      admin = await Employee.create({
        firstName: 'NWF',
        lastName: 'Admin',
        email,
        passwordHash,
        role: 'admin',
      });

      return res.json({ message: 'Admin created & password set' });
    }

    // Force this user to be admin and reset password
    admin.role = 'admin';
    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({ message: 'Admin password updated' });
  } catch (err) {
    console.error('Admin reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
