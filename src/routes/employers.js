// src/routes/employers.js

const express = require('express');
const Employer = require('../models/Employer'); // 👈 IMPORTANT: matches Employer.js

const router = express.Router();

/**
 * POST /api/employers/signup
 * Employer submits signup form
 */
router.post('/signup', async (req, res) => {
  try {
    const {
      companyName,
      ein,
      companyEmail,
      address,
      documents,
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    const employer = await Employer.create({
      companyName,
      ein,
      companyEmail,
      address: {
        line1: address?.line1 || '',
        line2: address?.line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        zip: address?.zip || '',
      },
      documents: Array.isArray(documents) ? documents : [],
      status: 'pending',
    });

    res.status(201).json(employer);
  } catch (err) {
    console.error('Employer signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers
 * Admin – Get ALL employers
 */
router.get('/', async (req, res) => {
  try {
    const employers = await Employer.find().sort({ createdAt: -1 }).lean();
    res.json(employers);
  } catch (err) {
    console.error('Get employers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/pending
 * Admin – Get employers waiting for approval
 */
router.get('/pending', async (req, res) => {
  try {
    const pending = await Employer.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .lean();

    res.json(pending);
  } catch (err) {
    console.error('Get pending employers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/employers/:id/approve
 * Mark employer as approved
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Employer.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Approve employer error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/employers/:id/reject
 * Mark employer as rejected
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Employer.findByIdAndUpdate(
      id,
      { status: 'rejected' },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Reject employer error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
