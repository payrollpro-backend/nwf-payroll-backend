// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth');

// ✅ SMTP Email Utility (Hostinger)
const { sendEmail } = require('../utils/sendEmail');

// (Optional) If you still use Klaviyo elsewhere, keep it, but we won't rely on it for password reset.
// const klaviyoService = require('../services/klaviyoService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

// ✅ Use Render ENV if present; default to your live domain (no www)
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nwfpayroll.com';

// --- Payment Link URL ---
const STRIPE_PAYMENT_LINK_URL =
  process.env.STRIPE_PAYMENT_LINK_URL || 'https://buy.stripe.com/test_default_link_update_env';

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

// Helper to generate a temp password
function generateTempPassword() {
  return crypto.randomBytes(16).toString('base64').slice(0, 12);
}

/**
 * ADMIN REGISTER
 */
router.post('/admin-register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const existing = await Employee.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Employee.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
    });
    const token = signToken(admin);

    res.status(201).json({ token, user: { id: admin._id, email: admin.email, role: 'admin' } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * REGISTER (Employer/Solo)
 */
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, workEmail, companyName, employeeCount } = req.body;

    if (!firstName || !workEmail || !companyName || !employeeCount) {
      return res
        .status(400)
        .json({ error: 'Missing required fields (Name, Email, Company, Employee Count)' });
    }

    const email = workEmail.toLowerCase();

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Please log in.' });
    }

    const rawTempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(rawTempPassword, 10);

    const isSoloClient = parseInt(employeeCount) <= 1;

    const newClient = await Employee.create({
      firstName,
      lastName,
      email,
      companyName,
      employeeCount: parseInt(employeeCount),
      passwordHash,
      role: 'employer',
      isSelfEmployed: isSoloClient,
      isSubscribed: false,
      requiresPasswordChange: true,
      status: 'pending_payment',
    });

    const onboardingToken = jwt.sign(
      { id: newClient._id.toString(), purpose: 'onboarding' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'Account record created. Redirecting to payment.',
      onboardingToken,
      redirectUrl: STRIPE_PAYMENT_LINK_URL,
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: err.message || 'Failed to create account record.' });
  }
});

/**
 * LOGIN
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const user = await Employee.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'User not found' });

    if (!user.passwordHash) {
      user.passwordHash = await bcrypt.hash(password, 10);
      if (!user.role) user.role = 'admin';
      await user.save();
    } else {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(400).json({ error: 'Invalid password' });
    }

    // If role is passed, enforce portal access (admins can access any)
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
        requiresPasswordChange: user.requiresPasswordChange,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * CHANGE PASSWORD (auth required)
 * POST /api/auth/change-password
 * body: { newPassword }
 */
router.post('/change-password', requireAuth(['employee', 'employer', 'admin']), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await Employee.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    user.requiresPasswordChange = false;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * FORGOT PASSWORD (works for employee/employer/admin)
 * POST /api/auth/forgot-password
 * body: { email }
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await Employee.findOne({ email });

    // Always respond success to avoid account enumeration
    if (!user) {
      return res.json({ message: 'If an account matches that email, a reset link was sent.' });
    }

    const resetToken = jwt.sign(
      { id: user._id.toString(), email: user.email, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ✅ Your frontend pages live in /nwfpayroll/
    const resetLink =
  `${FRONTEND_URL}/admin/reset-password.html` +
  `?token=${encodeURIComponent(resetToken)}` +
  `&email=${encodeURIComponent(email)}`;


    await sendEmail({
      to: user.email,
      subject: 'Reset your NWF Payroll password',
      text: `Reset your password: ${resetLink}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
          <h2 style="margin:0 0 10px">Reset your password</h2>
          <p style="margin:0 0 14px">Click the button below to reset your password.</p>
          <p style="margin:0 0 18px">
            <a href="${resetLink}"
               style="display:inline-block;padding:10px 14px;border:1px solid #111;border-radius:10px;color:#111;text-decoration:none">
              Reset Password
            </a>
          </p>
          <p style="margin:0;color:#666;font-size:13px">
            This link expires in 1 hour. If you didn’t request this, ignore this email.
          </p>
        </div>
      `,
    });

    return res.json({ message: 'If an account matches that email, a reset link was sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * RESET PASSWORD
 * POST /api/auth/reset-password
 * body: { email, token, newPassword }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Missing email, token, or newPassword' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please try again.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid token type.' });
    }

    if (decoded.email && decoded.email.toLowerCase() !== email) {
      return res.status(400).json({ error: 'Token does not match this email.' });
    }

    const user = await Employee.findOne({ _id: decoded.id, email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.requiresPasswordChange = false;
    await user.save();

    return res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
