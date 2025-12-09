// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // <-- ADDED: For generating temporary password
const Employee = require('../models/Employee');
const klaviyoService = require('../services/klaviyoService');
const { requireAuth } = require('../middleware/auth'); 

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';
const FRONTEND_URL = 'https://www.nwfpayroll.com'; 

// --- NEW CONFIGURATION: Payment Link URL ---
// Your backend must know the Stripe link to send back to the frontend.
const STRIPE_PAYMENT_LINK_URL = process.env.STRIPE_PAYMENT_LINK_URL || 'https://buy.stripe.com/test_default_link_update_env';
// --- END NEW CONFIGURATION ---

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


// 🛑 NEW REGISTRATION ENDPOINT (Replaces missing /onboarding/start)
// Frontend will hit this endpoint: /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, workEmail, companyName, employeeCount } = req.body;
    
    if (!firstName || !workEmail || !companyName || !employeeCount) {
      return res.status(400).json({ error: 'Missing required fields (Name, Email, Company, Employee Count)' });
    }
    
    const email = workEmail.toLowerCase();
    
    // 1. Check for existing user
    const existing = await Employee.findOne({ email });
    if (existing) {
        return res.status(400).json({ error: 'Email already registered. Please log in.' });
    }

    // 2. Generate temporary password (since user didn't provide one)
    const rawTempPassword = generateTempPassword(); 
    const passwordHash = await bcrypt.hash(rawTempPassword, 10);

    // Determine if the client is a Solo entrepreneur (EmployeeCount <= 1)
    const isSoloClient = parseInt(employeeCount) <= 1;

    // 3. Create the basic Employer/Solo client record
    const newClient = await Employee.create({
        firstName, 
        lastName, 
        email, 
        companyName,
        employeeCount: parseInt(employeeCount),
        passwordHash, 
        role: 'employer',
        isSelfEmployed: isSoloClient,
        isSubscribed: false, // Must pay first
        requiresPasswordChange: true, // Force password change after first auto-login (post-payment)
        status: 'pending_payment', // Track their status
    });

    // 4. Generate a unique onboarding token for client tracking
    // We use the JWT for this, but specify a short lifespan/purpose
    const onboardingToken = jwt.sign(
        { id: newClient._id.toString(), purpose: 'onboarding' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    
    // 5. Success response: send the token and the Stripe link back.
    res.status(201).json({ 
        message: 'Account record created. Redirecting to payment.',
        onboardingToken: onboardingToken,
        // The frontend will now use this URL to redirect the user
        redirectUrl: STRIPE_PAYMENT_LINK_URL, 
    });

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: err.message || 'Failed to create account record.' });
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
      // This path handles legacy users without a hash, which should be rare now.
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
