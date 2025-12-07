// src/routes/taxforms.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const { requireAuth } = require('../middleware/auth');

// Helper: Format Currency
const fmt = (n) => (n || 0).toFixed(2);

// --- W-2 GENERATOR (Employees) ---
async function generateW2(employee, year, stats, res) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="W2-${employee.lastName}-${year}.pdf"`);
  doc.pipe(res);

  // TITLE
  doc.font('Helvetica-Bold').fontSize(24).text(`20${year.slice(-2)} W-2 Wage and Tax Statement`, { align: 'center' });
  doc.fontSize(10).text('Copy B - To Be Filed With Employee\'s Federal Tax Return', { align: 'center' });
  doc.moveDown(2);

  // DRAW BOXES
  const startY = 100;
  
  // Left Column (Employer/Employee Info)
  doc.rect(30, startY, 250, 80).stroke();
  doc.text('c. Employer\'s name, address, and ZIP code', 35, startY + 5);
  doc.font('Helvetica').text((employee.companyName || "NWF Payroll Services").toUpperCase(), 35, startY + 20);
  doc.text("123 PAYROLL STREET", 35, startY + 35);
  doc.text("ATLANTA, GA 30303", 35, startY + 50);

  doc.font('Helvetica-Bold');
  doc.rect(30, startY + 90, 250, 80).stroke();
  doc.text('e. Employee\'s name, address, and ZIP code', 35, startY + 95);
  doc.font('Helvetica').text(`${employee.firstName} ${employee.lastName}`.toUpperCase(), 35, startY + 110);
  doc.text((employee.address?.line1 || "").toUpperCase(), 35, startY + 125);
  doc.text(`${employee.address?.city || ''}, ${employee.address?.state || ''} ${employee.address?.zip || ''}`.toUpperCase(), 35, startY + 140);

  doc.font('Helvetica-Bold');
  doc.rect(30, startY + 180, 250, 40).stroke();
  doc.text('a. Employee\'s SSN', 35, startY + 185);
  doc.font('Helvetica').text(employee.ssn || 'XXX-XX-XXXX', 35, startY + 200);

  // Right Column (Figures)
  const col2 = 300;
  
  // Box 1: Wages
  doc.font('Helvetica-Bold');
  doc.rect(col2, startY, 130, 40).stroke();
  doc.text('1 Wages, tips, other', col2 + 5, startY + 5);
  doc.font('Courier-Bold').fontSize(12).text(fmt(stats.wages), col2 + 5, startY + 20);

  // Box 2: Fed Tax
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(col2 + 130, startY, 130, 40).stroke();
  doc.text('2 Fed income tax', col2 + 135, startY + 5);
  doc.font('Courier-Bold').fontSize(12).text(fmt(stats.fed), col2 + 135, startY + 20);

  // Box 3: SS Wages
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(col2, startY + 40, 130, 40).stroke();
  doc.text('3 Social security wages', col2 + 5, startY + 45);
  doc.font('Courier-Bold').fontSize(12).text(fmt(stats.wages), col2 + 5, startY + 60);

  // Box 4: SS Tax
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(col2 + 130, startY + 40, 130, 40).stroke();
  doc.text('4 Social security tax', col2 + 135, startY + 45);
  doc.font('Courier-Bold').fontSize(12).text(fmt(stats.ss), col2 + 135, startY + 60);

  // Box 5: Medicare Wages
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(col2, startY + 80, 130, 40).stroke();
  doc.text('5 Medicare wages', col2 + 5, startY + 85);
  doc.font('Courier-Bold').fontSize(12).text(fmt(stats.wages), col2 + 5, startY + 100);

  // Box 6: Medicare Tax
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(col2 + 130, startY + 80, 130, 40).stroke();
  doc.text('6 Medicare tax', col2 + 135, startY + 85);
  doc.font('Courier-Bold').fontSize(12).text(fmt(stats.med), col2 + 135, startY + 100);

  // State
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(30, startY + 230, 530, 50).stroke();
  doc.text('15 State', 35, startY + 235);
  doc.text('16 State wages', 100, startY + 235);
  doc.text('17 State income tax', 200, startY + 235);
  
  doc.font('Courier-Bold').fontSize(12);
  doc.text("GA", 35, startY + 255);
  doc.text(fmt(stats.wages), 100, startY + 255);
  doc.text(fmt(stats.state), 200, startY + 255);

  doc.end();
}

// --- 1099-NEC GENERATOR (Contractors) ---
async function generate1099(employee, year, stats, res) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="1099-NEC-${employee.lastName}-${year}.pdf"`);
  doc.pipe(res);

  // TITLE
  doc.font('Helvetica-Bold').fontSize(24).text(`20${year.slice(-2)} Form 1099-NEC`, { align: 'center' });
  doc.fontSize(10).text('Nonemployee Compensation (Copy B)', { align: 'center' });
  doc.moveDown(2);

  const startY = 100;

  // Payer (Employer)
  doc.rect(30, startY, 250, 90).stroke();
  doc.text('PAYER\'S name, street address, city, state, ZIP', 35, startY + 5);
  doc.font('Helvetica').text((employee.companyName || "NWF Payroll Services").toUpperCase(), 35, startY + 20);
  doc.text("123 PAYROLL STREET\nATLANTA, GA 30303", 35, startY + 35);

  // Recipient (Contractor)
  doc.font('Helvetica-Bold');
  doc.rect(30, startY + 100, 250, 90).stroke();
  doc.text('RECIPIENT\'S name', 35, startY + 105);
  doc.font('Helvetica').text(`${employee.firstName} ${employee.lastName}`.toUpperCase(), 35, startY + 120);
  doc.text((employee.address?.line1 || "").toUpperCase(), 35, startY + 135);
  doc.text(`${employee.address?.city || ''}, ${employee.address?.state || ''} ${employee.address?.zip || ''}`.toUpperCase(), 35, startY + 150);

  // Box 1: Nonemployee Compensation
  const col2 = 300;
  doc.font('Helvetica-Bold');
  doc.rect(col2, startY, 200, 50).stroke();
  doc.text('1 Nonemployee compensation', col2 + 5, startY + 5);
  doc.font('Courier-Bold').fontSize(14).text('$' + fmt(stats.wages), col2 + 5, startY + 25);

  // Box 4: Federal Tax Withheld (Usually 0 for 1099)
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(col2, startY + 60, 200, 50).stroke();
  doc.text('4 Federal income tax withheld', col2 + 5, startY + 65);
  doc.font('Courier-Bold').fontSize(14).text('$' + fmt(stats.fed || 0), col2 + 5, startY + 85);

  // State Info
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(30, startY + 220, 500, 50).stroke();
  doc.text('5 State tax withheld', 35, startY + 225);
  doc.text('7 State income', 200, startY + 225);
  
  doc.font('Courier-Bold').fontSize(12);
  doc.text('$' + fmt(stats.state || 0), 35, startY + 245);
  doc.text('$' + fmt(stats.wages), 200, startY + 245);

  doc.end();
}

// =========================================================
// ROUTES
// =========================================================

// GET W-2
router.get('/w2/:employeeId/:year', requireAuth(['admin', 'employer', 'employee']), async (req, res) => {
  try {
    const { employeeId, year } = req.params;
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${Number(year) + 1}-01-01`);

    // 1. Get Employee
    const emp = await Employee.findById(employeeId);
    if (!emp) return res.status(404).send("Employee not found");

    // 2. Aggregate Data
    const stats = await PayrollRun.aggregate([
      { 
        $match: { 
          employee: new mongoose.Types.ObjectId(employeeId), 
          payDate: { $gte: start, $lt: end } 
        } 
      },
      {
        $group: {
          _id: null,
          wages: { $sum: "$grossPay" },
          fed: { $sum: "$federalIncomeTax" },
          state: { $sum: "$stateIncomeTax" },
          ss: { $sum: "$socialSecurity" },
          med: { $sum: "$medicare" }
        }
      }
    ]);

    const data = stats[0] || { wages: 0, fed: 0, state: 0, ss: 0, med: 0 };

    await generateW2(emp, year, data, res);

  } catch (err) {
    console.error("W2 Error:", err);
    res.status(500).send("Error generating W-2");
  }
});

// GET 1099-NEC (For Contractors)
router.get('/1099/:employeeId/:year', requireAuth(['admin', 'employer', 'employee']), async (req, res) => {
  try {
    const { employeeId, year } = req.params;
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${Number(year) + 1}-01-01`);

    const emp = await Employee.findById(employeeId);
    if (!emp) return res.status(404).send("Contractor not found");

    // For contractors, we typically just care about Gross Pay
    const stats = await PayrollRun.aggregate([
      { 
        $match: { 
          employee: new mongoose.Types.ObjectId(employeeId), 
          payDate: { $gte: start, $lt: end } 
        } 
      },
      {
        $group: {
          _id: null,
          wages: { $sum: "$grossPay" },
          // Backup withholding only
          fed: { $sum: "$federalIncomeTax" },
          state: { $sum: "$stateIncomeTax" }
        }
      }
    ]);

    const data = stats[0] || { wages: 0, fed: 0, state: 0 };

    await generate1099(emp, year, data, res);

  } catch (err) {
    console.error("1099 Error:", err);
    res.status(500).send("Error generating 1099");
  }
});

module.exports = router;
