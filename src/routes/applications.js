// src/routes/applications.js
const express = require('express');
const router = express.Router();
// ✅ FIX: Changed path from '../models/Application' to '../../models/Application'
const Application = require('../../models/Application'); 

// POST /api/applications - Handles job application submission
router.post('/', async (req, res) => {
    try {
        const { role, salaryExpectation, startDate, firstName, lastName, email, phone, portfolio, coverLetter, referral } = req.body;

        // Basic validation
        if (!role || !firstName || !lastName || !email || !salaryExpectation) {
            return res.status(400).json({ error: 'Missing required fields: role, name, email, salary expectation.' });
        }

        const newApplication = await Application.create({
            role, salaryExpectation, startDate, firstName, lastName, email, phone, portfolio, coverLetter, referral
        });

        res.status(201).json({ message: 'Application submitted successfully', id: newApplication._id });

    } catch (error) {
        console.error("Application Submission Error:", error);
        res.status(500).json({ error: 'Failed to save application data.' });
    }
});

module.exports = router;
