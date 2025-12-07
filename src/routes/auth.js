// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const klaviyoService = require('../services/klaviyoService');
const { requireAuth } = require('../middleware/auth'); // ✅ Needed for change-password

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';
const FRONTEND_URL = 'https://www.nwfpayroll.com'; 

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      employer: user.employer ? user.employer.toString() : null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/admin-register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Employee.create({ firstName, lastName, email, passwordHash, role: 'admin' });
    const token = signToken(admin);

    res.status(201).json({ token, user: { id: admin._id, email: admin.email, role: 'admin' } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ LOGIN (Updated)
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const user = await Employee.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    if (!user.passwordHash) {
      user.passwordHash = await bcrypt.hash(password, 10);
      if (!user.role) user.role = 'admin'; 
      await user.save();
    } else {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(400).json({ error: 'Invalid password' });
    }

    if (role && user.role !== role && user.role !== 'admin') {
       return res.status(403).json({ error: 'Access denied for this portal' });
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
        employer: user.employer || null,
        requiresPasswordChange: user.requiresPasswordChange // ✅ Send Flag
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ NEW: CHANGE PASSWORD
router.post('/change-password', requireAuth(['employee', 'employer', 'admin']), async (req, res) => {
    try {
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const user = await Employee.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        
        user.requiresPasswordChange = false; // Turn flag off
        
        await user.save();

        res.json({ message: "Password updated successfully" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PASSWORD RESET FLOW (Forgot Password)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await Employee.findOne({ email });
    if (!user) {
      return res.json({ message: 'If an account matches that email, a reset link was sent.' });
    }

    const resetToken = jwt.sign(
      { id: user._id.toString(), purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const resetLink = `${FRONTEND_URL}/reset-password.html?token=${resetToken}`;

    if (klaviyoService && klaviyoService.sendPasswordResetEmail) {
        await klaviyoService.sendPasswordResetEmail(user.email, resetLink);
    }

    res.json({ message: 'If an account matches that email, a reset link was sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password-confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Missing token or password' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please try again.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid token type.' });
    }

    const user = await Employee.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
