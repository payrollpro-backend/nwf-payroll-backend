const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      employerId: user.employer ? user.employer.toString() : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// One-time admin creator (you can call once, then disable)
router.post('/admin-register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
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
    res.status(400).json({ error: err.message });
  }
});

// Login for admin/employer/employee
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Employee.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
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
        employerId: user.employer || null,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
