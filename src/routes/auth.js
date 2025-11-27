const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const router = express.Router();

// 👇 add this
const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

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
      id: user._id.toString(),
      role: user.role,
      employerId: user.employer ? user.employer.toString() : null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

      id: user._id.toString(),
      role: user.role,
      employerId: user.employer ? user.employer.toString() : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Create first admin (one time)
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

// Login for admin/employer/employee
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // 1) Check body first
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Missing email or password', body: req.body });
    }

    // 2) Find user
    const user = await Employee.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found for this email' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        error: 'This user has no password set. Create admin with /admin-register or reset password.',
      });
    }

    // 3) Check password
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // 4) Token
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

// TEMP: Admin password reset helper
router.patch('/admin-reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Email and newPassword are required' });
    }

    const admin = await Employee.findOne({ email });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (admin.role !== 'admin') {
      return res.status(400).json({ error: 'User is not an admin account' });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({ message: 'Admin password updated' });
  } catch (err) {
    console.error('Admin reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
