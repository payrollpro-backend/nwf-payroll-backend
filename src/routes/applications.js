// src/routes/applications.js
const express = require('express');
const router = express.Router();
// ✅ CORRECTED PATH: Use './models/Application' or ensure relative path is correct.
// Since Render structure often nests files, we'll try to go up one more or adjust the path.
// The safer path is usually '../models/Application' if the structure is routes/models under src/.
// Based on the error, the correct path should be relative to the module system's understanding.
// Let's assume the module path is correct relative to the server root:
const Application = require('../models/Application'); 

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
