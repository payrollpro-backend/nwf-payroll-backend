// src/routes/paystubs.js
const express = require('express');
const router = express.Router();

// Simple health check for paystubs routes
router.get('/', (req, res) => {
  res.json({ message: 'NWF paystubs route is working' });
});

module.exports = router;
