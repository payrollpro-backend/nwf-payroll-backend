const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// One-time admin registration
router.post('/admin-register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existingAdmin = await Employee.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res
        .status(400)
        .json({ error: 'Admin already exists. Use /login instead.' });
    }

    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ error: 'firstName, lastName, email and password are required.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'admin',
      companyName: 'NWF Payroll',
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
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Employee.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
    res.status(400).json({ error: err.message });
  }
});

// Me
router.get('/me', requireAuth, async (req, res) => {
  const u = req.user;
  res.json({
    id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
  });
});

// Change password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: 'Old password is incorrect' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;