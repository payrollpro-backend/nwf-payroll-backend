// src/routes/employers.js

const express = require('express');
const mongoose = require('mongoose');

// ✅ Load the schema file for side-effect (it registers the model with Mongoose)
require('../models/employers');

// ✅ Now safely grab the model by name
const Employer = mongoose.model('Employer');

const router = express.Router();

/**
 * POST /api/employers/signup
 * Public: Employer submits onboarding info
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
 * Admin: list all employers
 */
router.get('/', async (req, res) => {
  try {
    const employers = await Employer.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json(employers);
  } catch (err) {
    console.error('Get employers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employers/pending
 * Admin: list pending employers
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
 * Admin: approve employer
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Employer.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true },
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
 * Admin: reject employer
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Employer.findByIdAndUpdate(
      id,
      { status: 'rejected' },
      { new: true },
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
