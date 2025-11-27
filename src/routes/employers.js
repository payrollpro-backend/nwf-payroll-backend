// src/routes/employers.js
const express = require('express');
const Employer = require('../models/Employer'); // make sure this path matches your model

const router = express.Router();

/**
 * POST /api/employers/signup
 * Employer signup (public-facing form)
 */
router.post('/signup', async (req, res) => {
  try {
    const {
      companyName,
      ein,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      documents, // optional: [{ url, label }]
    } = req.body;

    if (!companyName || !ein || !email) {
      return res.status(400).json({ error: 'companyName, ein, and email are required' });
    }

    const employer = await Employer.create({
      companyName,
      ein,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      documents: Array.isArray(documents) ? documents : [],
      status: 'pending', // waiting for your approval
    });

    res.status(201).json(employer);
  } catch (err) {
    console.error('employer signup error:', err);
    res.status(500).json({ error: err.message || 'Employer signup failed' });
  }
});

/**
 * GET /api/employers
 * List ALL employers (admin view)
 */
router.get('/', async (req, res) => {
  try {
    const employers = await Employer.find().sort({ createdAt: -1 }).lean();
    res.json(employers);
  } catch (err) {
    console.error('list employers error:', err);
    res.status(500).json({ error: err.message || 'Could not load employers' });
  }
});

/**
 * GET /api/employers/pending
 * List only employers that are pending verification
 */
router.get('/pending', async (req, res) => {
  try {
    const pending = await Employer.find({
      $or: [{ status: 'pending' }, { verificationStatus: 'pending' }, { status: { $exists: false } }],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(pending);
  } catch (err) {
    console.error('pending employers error:', err);
    res.status(500).json({ error: err.message || 'Could not load pending employers' });
  }
});

/**
 * POST /api/employers/:id/approve
 * Approve an employer (used by verification.html)
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const employer = await Employer.findByIdAndUpdate(
      id,
      {
        status: 'active',
        verificationStatus: 'verified',
      },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    res.json(employer);
  } catch (err) {
    console.error('approve employer error:', err);
    res.status(500).json({ error: err.message || 'Could not approve employer' });
  }
});

/**
 * POST /api/employers/:id/reject
 * Reject an employer (used by verification.html)
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const employer = await Employer.findByIdAndUpdate(
      id,
      {
        status: 'disabled',
        verificationStatus: 'rejected',
      },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    res.json(employer);
  } catch (err) {
    console.error('reject employer error:', err);
    res.status(500).json({ error: err.message || 'Could not reject employer' });
  }
});

module.exports = router;
