// src/routes/paystubs.js
const express = require('express');
const mongoose = require('mongoose');
const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');
const router = express.Router();

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  console.error("⚠️ PDFKit is not installed. Run 'npm install pdfkit'");
}

// --- HELPERS ---
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString();

// --- TAX CALCULATOR FALLBACK ---
function calculateGaTaxes(gross) {
  const safeGross = gross || 0;
  const fed = safeGross * 0.1780;
  const state = safeGross * 0.0543;
  const ss = safeGross * 0.062;
  const med = safeGross * 0.0145;
  return {
    fed, state, ss, med,
    total: fed + state + ss + med,
    net: safeGross - (fed + state + ss + med)
  };
}

// --- PDF GENERATOR (MATCHING UPLOADED IMAGE) ---
async function generateSinglePagePdf(paystub, res) {
  if (!PDFDocument) throw new Error("PDFKit library missing.");

  const doc = new PDFDocument({ size: 'LETTER', margin: 30 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="paystub-${paystub._id}.pdf"`);
  
  doc.pipe(res);

  // --- DATA PREP ---
  const emp = paystub.employee || {};
  const gross = paystub.grossPay || 0;
  const taxes = calculateGaTaxes(gross);
  const net = paystub.netPay || taxes.net;

  // Values
  const fedVal = paystub.federalIncomeTax ?? taxes.fed;
  const stateVal = paystub.stateIncomeTax ?? taxes.state;
  const ssVal = paystub.socialSecurity ?? taxes.ss;
  const medVal = paystub.medicare ?? taxes.med;

  // YTD
  const ytdGross = paystub.ytdGross || (gross * 12);
  const ytdFed = paystub.ytdFederalIncomeTax || (fedVal * 12);
  const ytdState = paystub.ytdStateIncomeTax || (stateVal * 12);
  const ytdSS = paystub.ytdSocialSecurity || (ssVal * 12);
  const ytdMed = paystub.ytdMedicare || (medVal * 12);

  // Strings
  const empName = `${emp.lastName || ''}, ${emp.firstName || ''}`.toUpperCase(); // GORDON, DAVID style
  const empAddr1 = (emp.address?.line1 || "").toUpperCase();
  const empAddr2 = `${emp.address?.city || ''}, ${emp.address?.state || ''} ${emp.address?.zip || ''}`.toUpperCase();
  const empId = emp.externalEmployeeId || `xxxxxxx${emp._id.toString().slice(-6)}`;

  const coName = (emp.companyName || "NSE MANAGEMENT INC").toUpperCase();
  const coAddr1 = "4711 NUTMEG WAY SW"; 
  const coAddr2 = "LILBURN, GA 30047";

  // Dates
  // Mock dates if missing to match the dense layout
  const checkDate = fmtDate(paystub.payDate);
  const pStart = fmtDate(paystub.periodStart || paystub.payPeriodStart);
  const pEnd = fmtDate(paystub.periodEnd || paystub.payPeriodEnd);

  // Verification
  const verifyCode = paystub.verificationCode || "PENDING";
  const verifyUrl = "https://nwfpayroll.com/verify";

  // ======================================================
  // DRAWING FUNCTION (Renders one stub)
  // ======================================================
  function drawStub(startY) {
    // 1. COMPANY HEADER (Top Left)
    doc.font('Helvetica-Bold').fontSize(14).text(coName, 30, startY);
    doc.font('Helvetica').fontSize(10).text(coAddr1, 30, startY + 18);
    doc.text(coAddr2, 30, startY + 30);

    // 2. NWF LOGO TEXT (Top Right)
    // Simulating the logo text from image
    doc.font('Helvetica-BoldOblique').fontSize(12).text('NWF PAYROLL SERVICES', 400, startY, { align: 'right' });
    doc.font('Helvetica').fontSize(6).text('PAYROLL FOR SMALL BUSINESSES & SELF-EMPLOYED', 400, startY + 14, { align: 'right' });

    // 3. DATES (Right Side, below logo)
    const dateX = 400;
    const dateY = startY + 40;
    doc.font('Helvetica').fontSize(9);
    doc.text('Check Date:', dateX, dateY);           doc.text(checkDate, 500, dateY, { align: 'right' });
    doc.text('Pay Period Beginning:', dateX, dateY + 12); doc.text(pStart, 500, dateY + 12, { align: 'right' });
    doc.text('Pay Period Ending:', dateX, dateY + 24);    doc.text(pEnd, 500, dateY + 24, { align: 'right' });

    // 4. EMPLOYEE INFO
    const empY = startY + 90;
    // Left side: Label + Name + ID
    doc.font('Helvetica-Bold').fontSize(9).text('EMPLOYEE', 30, empY);
    doc.font('Helvetica').text(empName, 30, empY + 12);
    doc.text(`Employee ID:${empId}`, 30, empY + 24);

    // Right side: Name + Address (Big)
    doc.font('Helvetica-Bold').fontSize(12).text(empName, 350, empY - 10); // Name bold right
    doc.font('Helvetica').fontSize(11).text(empAddr1, 350, empY + 6);
    doc.text(empAddr2, 350, empY + 20);

    // 5. TABLES (Earnings vs Deductions)
    const tableY = startY + 140;
    
    // -- EARNINGS (Left) --
    doc.font('Helvetica').fontSize(9);
    // Headers
    doc.text('Earnings', 30, tableY);
    doc.text('Hours', 120, tableY);
    doc.text('Rate', 160, tableY);
    doc.text('Current', 200, tableY, { align: 'right', width: 60 });
    doc.text('YTD', 270, tableY, { align: 'right', width: 60 });
    doc.moveTo(30, tableY + 12).lineTo(330, tableY + 12).stroke();

    // Row 1: Regular
    let ey = tableY + 18;
    doc.text('Regular', 30, ey);
    doc.text('80.00', 120, ey);
    doc.text(fmt(gross), 200, ey, { align: 'right', width: 60 });
    doc.text(fmt(ytdGross), 270, ey, { align: 'right', width: 60 });

    // -- DEDUCTIONS (Right) --
    const rightStart = 350;
    // Headers
    doc.text('Deductions From Gross:', rightStart, tableY);
    doc.text('Current', 480, tableY, { align: 'right', width: 50 });
    doc.text('YTD', 540, tableY, { align: 'right', width: 50 });
    doc.moveTo(rightStart, tableY + 12).lineTo(590, tableY + 12).stroke();

    // Rows
    let dy = tableY + 18;
    // Gross Row (As per image)
    doc.text('Gross', rightStart, dy);
    doc.text(fmt(gross), 480, dy, { align: 'right', width: 50 });
    doc.text(fmt(ytdGross), 540, dy, { align: 'right', width: 50 });
    dy += 12;

    const taxRows = [
        { l: 'Federal Income Tax', c: fedVal, y: ytdFed },
        { l: 'Social Security (Employee)', c: ssVal, y: ytdSS },
        { l: 'Medicare (Employee)', c: medVal, y: ytdMed },
        { l: 'State of GA Income Tax', c: stateVal, y: ytdState },
    ];

    taxRows.forEach(t => {
        doc.text(t.l, rightStart, dy);
        doc.text(`(${fmt(t.c)})`, 480, dy, { align: 'right', width: 50 }); // Parentheses style
        doc.text(`(${fmt(t.y)})`, 540, dy, { align: 'right', width: 50 });
        dy += 12;
    });

    // 6. NET PAY
    const netY = dy + 20;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Net Pay:', rightStart, netY);
    
    doc.fontSize(12);
    doc.text('$', 470, netY);
    doc.text(fmt(net), 490, netY);
    doc.text(fmt(ytdGross - (ytdFed+ytdSS+ytdMed+ytdState)), 540, netY, { align: 'right', width: 50 }); // Calc YTD Net
  }

  // --- DRAW PAGE ---
  
  // 1. Top Stub
  drawStub(30);

  // 2. Middle Gradient Bar (Simulation)
  const barY = 280;
  // Create a gradient-like effect with lines or a solid box
  doc.rect(0, barY, 612, 50).fillOpacity(0.5).fill('#3d7c5b'); // Greenish bar spanning page width
  doc.fillOpacity(1).fillColor('black'); // Reset

  // 3. Bottom Stub (Exact copy)
  drawStub(360);

  // 4. Verification Footer
  const footerY = 700;
  doc.font('Courier').fontSize(8).text('Verification', 280, footerY);
  doc.text(`Code: ${verifyCode}`, 280, footerY + 10);
  doc.text(`Verify online at: ${verifyUrl}`, 280, footerY + 20);
  
  // Sidebar Watermark (Right Edge)
  doc.save();
  doc.rotate(90, { origin: [590, 400] });
  doc.font('Helvetica').fontSize(6).fillColor('#999');
  doc.text(`https://nwf-payroll-backend.onrender.com/api/verify-paystub/${paystub._id}`, 590, 400);
  doc.restore();

  doc.end();
}

// --- ROUTES ---
router.get('/', async (req, res) => {
  try { const paystubs = await Paystub.find().populate('employee').sort({ payDate: -1 }); res.json(paystubs); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-payroll/:runId', async (req, res) => {
  try { const stub = await Paystub.findOne({ payrollRun: req.params.runId }).populate('employee'); res.json(stub || {}); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.id).populate('employee');
    if (!paystub) return res.status(404).send('Not Found');
    await generateSinglePagePdf(paystub, res);
  } catch (err) { res.status(500).send(`PDF Error: ${err.message}`); }
});

module.exports = router;
