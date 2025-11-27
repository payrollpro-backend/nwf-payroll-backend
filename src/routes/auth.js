// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const router = express.Router();

/**
 * Sign a JWT for a user/admin
 */
function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Simple inline auth middleware for routes that need login
 * (Used for /me and /change-password)
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.id;
    req.userRole = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * OPTIONAL: create an admin user
 * Call once via POST /api/auth/admin-register then disable/remove in production.
 */
router.post('/admin-register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'admin',  // make sure your Employee schema allows this role
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
    res.status(400).json({ error: err.message });
  }
});

/**
 * Login (admin or employee, depending on role in DB)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Employee.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash || '');
    if (!match) {
      return res.status(400).json({ error: 'Invalid email or password' });
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
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get current user profile based on token
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await Employee.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Change password for logged-in user
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await Employee.findById(req.userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error('change-password error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
