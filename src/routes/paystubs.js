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

// --- PDF GENERATOR ---
async function generateSinglePagePdf(paystub, res) {
  if (!PDFDocument) throw new Error("PDFKit library missing.");

  const doc = new PDFDocument({ size: 'LETTER', margin: 30 });
  
  // --- ✅ NEW FILENAME LOGIC START ---
  const emp = paystub.employee || {};
  
  // 1. Format Date: MM-DD-YYYY
  const pDate = new Date(paystub.payDate);
  const dateStr = `${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}-${pDate.getFullYear()}`;
  
  // 2. Format ID: Last 6 characters
  // Use external ID if available, otherwise use database _id
  const rawId = emp.externalEmployeeId || emp._id.toString(); 
  const shortId = rawId.slice(-6); 

  const finalFileName = `paystub-${dateStr}-${shortId}.pdf`;
  // --- ✅ NEW FILENAME LOGIC END ---

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${finalFileName}"`);
  
  doc.pipe(res);

  // --- DATA PREP ---
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
  const empName = `${emp.lastName || ''}, ${emp.firstName || ''}`.toUpperCase();
  const empAddr1 = (emp.address?.line1 || "").toUpperCase();
  const empAddr2 = `${emp.address?.city || ''}, ${emp.address?.state || ''} ${emp.address?.zip || ''}`.toUpperCase();
  
  // Use full ID on the stub itself (Visual), but filename uses short ID
  const empIdVisual = emp.externalEmployeeId || `xxxxxxx${emp._id.toString().slice(-6)}`;

  // Employer Info
  const employer = paystub.employer || {};
  const coName = (employer.companyName || emp.companyName || "COMPANY NAME NOT SET").toUpperCase();
  
  const empAddrData = employer.address || {};
  const coAddr1 = (empAddrData.line1 || "ADDRESS NOT ON FILE").toUpperCase();
  const coAddr2 = `${empAddrData.city || ''}, ${empAddrData.state || ''} ${empAddrData.zip || ''}`.toUpperCase().trim();
  const finalCoAddr2 = coAddr2 === ",  " ? "" : coAddr2;

  // Dates
  const checkDate = fmtDate(paystub.payDate);
  const pStart = fmtDate(paystub.periodStart || paystub.payPeriodStart);
  const pEnd = fmtDate(paystub.periodEnd || paystub.payPeriodEnd);

  // Verification
  const verifyCode = paystub.verificationCode || "PENDING";
  const verifyUrl = "https://nwfpayroll.com/verify";

  // ======================================================
  // DRAWING FUNCTION
  // ======================================================
  function drawStub(startY) {
    // 1. COMPANY HEADER
    doc.font('Helvetica-Bold').fontSize(14).text(coName, 30, startY);
    doc.font('Helvetica').fontSize(10).text(coAddr1, 30, startY + 18);
    doc.text(finalCoAddr2, 30, startY + 30);

    // 2. NWF LOGO TEXT
    doc.font('Helvetica-BoldOblique').fontSize(12).text('NWF PAYROLL SERVICES', 400, startY, { align: 'right' });
    doc.font('Helvetica').fontSize(6).text('PAYROLL FOR SMALL BUSINESSES & SELF-EMPLOYED', 400, startY + 14, { align: 'right' });

    // 3. DATES
    const dateX = 400;
    const dateY = startY + 40;
    doc.font('Helvetica').fontSize(9);
    doc.text('Check Date:', dateX, dateY);           doc.text(checkDate, 500, dateY, { align: 'right' });
    doc.text('Pay Period Beginning:', dateX, dateY + 12); doc.text(pStart, 500, dateY + 12, { align: 'right' });
    doc.text('Pay Period Ending:', dateX, dateY + 24);    doc.text(pEnd, 500, dateY + 24, { align: 'right' });

    // 4. EMPLOYEE INFO
    const empY = startY + 90;
    doc.font('Helvetica-Bold').fontSize(9).text('EMPLOYEE', 30, empY);
    doc.font('Helvetica').text(empName, 30, empY + 12);
    doc.text(`Employee ID:${empIdVisual}`, 30, empY + 24);

    doc.font('Helvetica-Bold').fontSize(12).text(empName, 350, empY - 10);
    doc.font('Helvetica').fontSize(11).text(empAddr1, 350, empY + 6);
    doc.text(empAddr2, 350, empY + 20);

    // 5. TABLES
    const tableY = startY + 140;
    
    // -- EARNINGS --
    doc.font('Helvetica').fontSize(9);
    doc.text('Earnings', 30, tableY);
    doc.text('Hours', 120, tableY);
    doc.text('Rate', 160, tableY);
    doc.text('Current', 200, tableY, { align: 'right', width: 60 });
    doc.text('YTD', 270, tableY, { align: 'right', width: 60 });
    doc.moveTo(30, tableY + 12).lineTo(330, tableY + 12).stroke();

    let ey = tableY + 18;
    doc.text('Regular', 30, ey);
    doc.text('80.00', 120, ey);
    doc.text(fmt(gross), 200, ey, { align: 'right', width: 60 });
    doc.text(fmt(ytdGross), 270, ey, { align: 'right', width: 60 });

    // -- DEDUCTIONS --
    const rightStart = 350;
    doc.text('Deductions From Gross:', rightStart, tableY);
    doc.text('Current', 480, tableY, { align: 'right', width: 50 });
    doc.text('YTD', 540, tableY, { align: 'right', width: 50 });
    doc.moveTo(rightStart, tableY + 12).lineTo(590, tableY + 12).stroke();

    let dy = tableY + 18;
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
        doc.text(`(${fmt(t.c)})`, 480, dy, { align: 'right', width: 50 });
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
    doc.text(fmt(ytdGross - (ytdFed+ytdSS+ytdMed+ytdState)), 540, netY, { align: 'right', width: 50 });
  }

  // --- DRAW PAGE ---
  drawStub(30);

  const barY = 280;
  doc.rect(0, barY, 612, 50).fillOpacity(0.5).fill('#3d7c5b'); 
  doc.fillOpacity(1).fillColor('black'); 

  drawStub(360);

  // Footer Verification
  const footerY = 700;
  doc.font('Courier').fontSize(8).text('Verification', 280, footerY);
  doc.text(`Code: ${verifyCode}`, 280, footerY + 10);
  doc.text(`Verify online at: ${verifyUrl}`, 280, footerY + 20);
  
  doc.end();
}

// --- ROUTES ---
router.get('/', async (req, res) => { try { const paystubs = await Paystub.find().populate('employee').sort({ payDate: -1 }); res.json(paystubs); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/by-payroll/:runId', async (req, res) => { try { const stub = await Paystub.findOne({ payrollRun: req.params.runId }).populate('employee'); res.json(stub || {}); } catch (err) { res.status(500).json({ error: err.message }); } });

// PDF Route
router.get('/:id/pdf', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.id)
      .populate('employee')
      .populate('employer'); 

    if (!paystub) return res.status(404).send('Not Found');
    await generateSinglePagePdf(paystub, res);
  } catch (err) { res.status(500).send(`PDF Error: ${err.message}`); }
});

module.exports = router;
