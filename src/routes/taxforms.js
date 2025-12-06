// src/routes/taxforms.js
const express = require('express');
const PDFDocument = require('pdfkit');
const Employee = require('../models/Employee');
const Paystub = require('../models/Paystub');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Generate W-2 PDF for an employee
 */
router.get('/w2/:employeeId/:year', requireAuth(['employer', 'admin']), async (req, res) => {
  try {
    const { employeeId, year } = req.params;
    const emp = await Employee.findById(employeeId);
    
    if (!emp) return res.status(404).send('Employee not found');

    // Aggregate payroll data for the year
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31`);
    
    const paystubs = await Paystub.find({
      employee: employeeId,
      payDate: { $gte: start, $lte: end }
    });

    const totals = paystubs.reduce((acc, stub) => ({
      gross: acc.gross + (stub.grossPay || 0),
      fed: acc.fed + (stub.federalIncomeTax || 0),
      ss: acc.ss + (stub.socialSecurity || 0),
      med: acc.med + (stub.medicare || 0),
      state: acc.state + (stub.stateIncomeTax || 0)
    }), { gross: 0, fed: 0, ss: 0, med: 0, state: 0 });

    // Generate PDF
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="W2_${emp.lastName}_${year}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text(`Form W-2 Wage and Tax Statement ${year}`, { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).text(`Employer: ${emp.companyName || 'NWF Payroll Client'}`);
    doc.text(`Employee: ${emp.firstName} ${emp.lastName}`);
    doc.text(`SSN: XXX-XX-${(emp.externalEmployeeId || '0000').slice(-4)}`);
    doc.moveDown();

    doc.text(`1. Wages, tips, other comp:   $${totals.gross.toFixed(2)}`);
    doc.text(`2. Federal income tax withheld: $${totals.fed.toFixed(2)}`);
    doc.text(`3. Social security wages:     $${totals.gross.toFixed(2)}`);
    doc.text(`4. Social security tax withheld: $${totals.ss.toFixed(2)}`);
    doc.text(`5. Medicare wages and tips:   $${totals.gross.toFixed(2)}`);
    doc.text(`6. Medicare tax withheld:     $${totals.med.toFixed(2)}`);
    doc.text(`17. State income tax:         $${totals.state.toFixed(2)}`);

    doc.end();

  } catch (err) {
    res.status(500).send('Error generating W-2');
  }
});

module.exports = router;
