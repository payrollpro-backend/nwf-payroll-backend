// src/routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth');

// 🛑 FIX REQUIRED: Initialize the router here
const router = express.Router(); 

// Helper: ensure the current user is an ADMIN
function ensureAdmin(req, res) {
// ... (rest of the code) ...

// GET: List Employers (Fixed for Dropdown)
router.get('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    // This query is correct and should pull all companies
    const employers = await Employee.find({ role: 'employer' })
      .select('companyName firstName lastName email isSelfEmployed ein address')
      .sort({ companyName: 1 });

    res.json(employers); 
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employers' });
  }
});
// ... (Rest of admin.js logic remains the same) ...

module.exports = router;
