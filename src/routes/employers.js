const express = require('express');
const Employer = require('../models/Employer');

const router = express.Router();

// Public signup: employer submits info + docs for verification
router.post('/signup', async (req, res) => {
  try {
    const { companyName, ein, companyEmail, address, documents } = req.body;

    if (!companyName || !companyEmail) {
      return res.status(400).json({ error: 'companyName and companyEmail are required' });
    }

    const employer = await Employer.create({
      companyName,
      ein,
      companyEmail,
      address,
      documents,
      status: 'pending',
    });

    res.status(201).json({ employerId: employer._id });
  } catch (err) {
    console.error('employer signup error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

