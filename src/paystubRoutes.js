// src/routes/paystubRoutes.js

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee'); 
// Assuming a model for PayrollRun exists, if needed

const { buildPaystubHtml } = require('../utils/paystubTemplate'); 

// 🚨 NEW IMPORTS FOR THE CERTIFIED PDF FIX
const { 
  generatePaystubPdf, 
  injectMetadata 
} = require('../utils/certifiedPdfGenerator'); 

// ... (Existing GET routes for /, /employee/:employeeId, and /:id remain here) ...


// ✅ NEW ROUTE: GET /api/paystubs/:id/certified
// Downloads the certified, metadata-injected PDF
router.get('/:id/certified', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id)
      .populate('employee'); // Populate the employee for HTML generation

    if (!stub || !stub.employee) {
      return res.status(404).json({ message: 'Paystub or associated employee not found' });
    }
    
    // NOTE: You'll need to fetch the PayrollRun data here if it's separate
    // const payrollRun = await PayrollRun.findById(stub.payrollRunId);

    // 1. Generate the paystub HTML content
    const htmlContent = buildPaystubHtml({ 
      stub: stub.toObject(), 
      employee: stub.employee.toObject(),
      // payrollRun: payrollRun ? payrollRun.toObject() : null
    });

    // 2. Generate PDF buffer on the server using Puppeteer
    let pdfBuffer = await generatePaystubPdf(htmlContent); 

    // 3. Inject custom metadata (The Snappt Fix)
    pdfBuffer = await injectMetadata(pdfBuffer); 

    // 4. Send the final, certified PDF file
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': 'attachment; filename="certified_paystub.pdf"'
    });
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Error generating certified paystub:', err);
    // Send a generic error message, but log the full error on the server
    res.status(500).json({ message: 'Server error generating certified document.' });
  }
});

module.exports = router;
