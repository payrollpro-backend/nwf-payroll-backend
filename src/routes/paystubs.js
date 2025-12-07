// src/routes/paystubs.js
const express = require('express');
const router = express.Router();
const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  console.error("⚠️ PDFKit is not installed. Run 'npm install pdfkit --save'");
}

// --- HELPERS ---
const fmtMoney = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');

// Safe Date Formatter (MM/DD/YYYY)
const fmtDate = (d) => {
    if (!d) return new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const dateObj = new Date(d);
    return isNaN(dateObj.getTime()) 
        ? new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) 
        : dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

// --- TAX CALCULATOR FALLBACK ---
function calculateGaTaxes(gross) {
  const safeGross = gross || 0;
  // Estimated rates based on your sample
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
  
  // --- FILENAME LOGIC (paystub-MM-DD-YYYY-Last6ID.pdf) ---
  const pDate = new Date(paystub.payDate);
  const safeMonth = String((!isNaN(pDate.getMonth()) ? pDate.getMonth() : new Date().getMonth()) + 1).padStart(2, '0');
  const safeDay = String(!isNaN(pDate.getDate()) ? pDate.getDate() : new Date().getDate()).padStart(2, '0');
  const safeYear = !isNaN(pDate.getFullYear()) ? pDate.getFullYear() : new Date().getFullYear();
  
  const emp = paystub.employee || {};
  const rawId = emp.externalEmployeeId || emp._id.toString();
  const shortId = rawId.slice(-6);
  
  const finalFileName = `paystub-${safeMonth}-${safeDay}-${safeYear}-${shortId}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${finalFileName}"`);
  
  doc.pipe(res);

  // --- DATA PREP ---
  const gross = paystub.grossPay || 0;
  const taxes = calculateGaTaxes(gross);
  const net = paystub.netPay || taxes.net;

  // Use DB values or Fallback
  const fedVal = paystub.federalIncomeTax ?? taxes.fed;
  const stateVal = paystub.stateIncomeTax ?? taxes.state;
  const ssVal = paystub.socialSecurity ?? taxes.ss;
  const medVal = paystub.medicare ?? taxes.med;

  // YTD Logic
  const ytdGross = paystub.ytdGross || (gross * 12);
  const ytdFed = paystub.ytdFederalIncomeTax || (fedVal * 12);
  const ytdState = paystub.ytdStateIncomeTax || (stateVal * 12);
  const ytdSS = paystub.ytdSocialSecurity || (ssVal * 12);
  const ytdMed = paystub.ytdMedicare || (medVal * 12);

  // Strings
  // Name format: GORDON, DAVID (Last, First)
  const empName = `${emp.lastName || ''}, ${emp.firstName || ''}`.toUpperCase();
  
  const empAddr1 = (emp.address?.line1 || "").toUpperCase();
  const empAddr2 = `${emp.address?.city || ''}, ${emp.address?.state || ''} ${emp.address?.zip || ''}`.toUpperCase();
  const empIdVisual = emp.externalEmployeeId || `xxxxxxx${shortId}`;

  const employer = paystub.employer || {};
  const coName = (employer.companyName || emp.companyName || "NSE MANAGEMENT INC").toUpperCase();
  const empAddrData = employer.address || {};
  const coAddr1 = (empAddrData.line1 || "4711 NUTMEG WAY SW").toUpperCase();
  const coAddr2 = `${empAddrData.city || 'LILBURN'} ${empAddrData.state || 'GA'} ${empAddrData.zip || '30047'}`.toUpperCase();

  // Dates
  const checkDate = fmtDate(paystub.payDate);
  
  // Period Date Logic
  let pEndObj = paystub.periodEnd || paystub.payPeriodEnd || paystub.payDate || new Date();
  let pStartObj = paystub.periodStart || paystub.payPeriodStart;
  if (!pStartObj) {
      pStartObj = new Date(pEndObj);
      pStartObj.setDate(new Date(pEndObj).getDate() - 13);
  }
  const pStart = fmtDate(pStartObj);
  const pEnd = fmtDate(pEndObj);

  // Verification
  const verifyCode = paystub.verificationCode || "PENDING";
  const verifyUrl = "https://nwfpayroll.com/verify";

  // ======================================================
  // SHARED DRAWING FUNCTIONS
  // ======================================================
  
  function drawTables(startY) {
    const tableHeaderY = startY;
    const tableDataY = startY + 15;
    
    // --- EARNINGS (Left Side) ---
    // Headers
    doc.font('Helvetica').fontSize(8).fillColor('black');
    doc.text('Earnings', 30, tableHeaderY);
    doc.text('Hours', 110, tableHeaderY);
    doc.text('Rate', 160, tableHeaderY);
    doc.text('Current', 210, tableHeaderY, { align: 'right', width: 60 });
    doc.text('YTD', 280, tableHeaderY, { align: 'right', width: 60 });
    
    // Line under Earnings headers
    doc.moveTo(30, tableHeaderY + 10).lineTo(340, tableHeaderY + 10).stroke();

    // Data Row 1 (Regular)
    doc.text('Regular', 30, tableDataY);
    doc.text('80.00', 110, tableDataY); // Hardcoded standard hours
    // doc.text('55.00', 160, tableDataY); // Rate optional
    doc.text(fmtMoney(gross), 210, tableDataY, { align: 'right', width: 60 });
    doc.text(fmtMoney(ytdGross), 280, tableDataY, { align: 'right', width: 60 });


    // --- DEDUCTIONS (Right Side) ---
    const rightX = 360;
    // Headers
    doc.text('Deductions From Gross:', rightX, tableHeaderY);
    doc.text('Current', 480, tableHeaderY, { align: 'right', width: 50 });
    doc.text('YTD', 540, tableHeaderY, { align: 'right', width: 50 });
    
    // Line under Deductions headers
    doc.moveTo(rightX, tableHeaderY + 10).lineTo(590, tableHeaderY + 10).stroke();

    // Data Rows
    let dy = tableDataY;
    
    // Gross Row
    doc.text('Gross', rightX, dy);
    doc.text(fmtMoney(gross), 480, dy, { align: 'right', width: 50 });
    doc.text(fmtMoney(ytdGross), 540, dy, { align: 'right', width: 50 });
    dy += 12;

    const deductions = [
        { label: 'Federal Income Tax', c: fedVal, y: ytdFed },
        { label: 'Social Security (Employee)', c: ssVal, y: ytdSS },
        { label: 'Medicare (Employee)', c: medVal, y: ytdMed },
        { label: 'State of GA Income Tax', c: stateVal, y: ytdState }
    ];

    deductions.forEach(item => {
        doc.text(item.label, rightX, dy);
        // Using ( ) for deductions
        doc.text(`(${fmtMoney(item.c)})`, 480, dy, { align: 'right', width: 50 });
        doc.text(`(${fmtMoney(item.y)})`, 540, dy, { align: 'right', width: 50 });
        dy += 12;
    });

    return dy; // Return the Y position where the table ended
  }

  // ======================================================
  // 1. TOP STUB DRAWING
  // ======================================================
  const topY = 40;

  // Header Left (Company)
  doc.font('Helvetica-Bold').fontSize(14).text(coName, 30, topY);
  doc.font('Helvetica').fontSize(10).text(coAddr1, 30, topY + 18);
  doc.text(coAddr2, 30, topY + 30);

  // Header Right (Logo & Dates)
  doc.font('Helvetica-BoldOblique').fontSize(12).text('NWF PAYROLL SERVICES', 400, topY, { align: 'right' });
  doc.font('Helvetica').fontSize(5).text('PAYROLL FOR SMALL BUSINESSES & SELF-EMPLOYED', 400, topY + 12, { align: 'right' });

  // Date Block (Right)
  const dateY = topY + 40;
  doc.font('Helvetica').fontSize(9);
  doc.text('Check Date:', 380, dateY);           doc.text(checkDate, 500, dateY, { align: 'right' });
  doc.text('Pay Period Beginning:', 380, dateY + 12); doc.text(pStart, 500, dateY + 12, { align: 'right' });
  doc.text('Pay Period Ending:', 380, dateY + 24);    doc.text(pEnd, 500, dateY + 24, { align: 'right' });

  // Employee Info (Left)
  const empInfoY = topY + 100;
  doc.font('Helvetica-Bold').fontSize(9).text('EMPLOYEE', 30, empInfoY);
  doc.font('Helvetica').text(empName, 30, empInfoY + 15);
  doc.text(`Employee ID:${empIdVisual}`, 30, empInfoY + 28);

  // Tables
  const tableEndY = drawTables(empInfoY + 60);

  // Net Pay (Aligned with bottom of deductions table)
  const netY = tableEndY + 20;
  doc.font('Helvetica-Bold').fontSize(10).text('Net Pay:', 360, netY);
  
  doc.fontSize(12);
  doc.text('$', 470, netY);
  doc.text(fmtMoney(net), 480, netY, { align: 'right', width: 50 });
  
  // YTD Net
  const ytdNet = ytdGross - (ytdFed + ytdState + ytdSS + ytdMed);
  doc.text(fmtMoney(ytdNet), 540, netY, { align: 'right', width: 50 });


  // ======================================================
  // 2. MIDDLE SEPARATOR (GREEN BAR)
  // ======================================================
  const barY = 380;
  doc.rect(0, barY, 612, 60).fill('#1e5d36'); // Deep Green color
  doc.fillOpacity(1).fillColor('black'); // Reset


  // ======================================================
  // 3. BOTTOM STUB DRAWING (Earnings/Deductions/Address)
  // ======================================================
  const bottomStart = 460;

  // Draw Tables (Same as top)
  const bottomTableEnd = drawTables(bottomStart);

  // Employee Address Block (Bottom Left - Specific to this layout style)
  // This is placed below the earnings table on the bottom stub
  const btmAddrY = bottomTableEnd + 10;
  doc.font('Helvetica-Bold').fontSize(11).text(empName, 30, btmAddrY);
  doc.font('Helvetica').fontSize(10).text(empAddr1, 30, btmAddrY + 14);
  doc.text(empAddr2, 30, btmAddrY + 26);

  // Net Pay (Bottom Right)
  const btmNetY = bottomTableEnd + 20;
  doc.font('Helvetica-Bold').fontSize(10).text('Net Pay:', 360, btmNetY);
  doc.fontSize(12).text('$', 470, btmNetY);
  doc.text(fmtMoney(net), 480, btmNetY, { align: 'right', width: 50 });
  doc.text(fmtMoney(ytdNet), 540, btmNetY, { align: 'right', width: 50 });


  // ======================================================
  // 4. FOOTER (Verification)
  // ======================================================
  const footerY = 730;
  doc.font('Courier').fontSize(8).fillColor('#333');
  doc.text('Verification', 280, footerY, { align: 'center' });
  doc.text(`Code: ${verifyCode}`, 280, footerY + 10, { align: 'center' });
  doc.text(`Verify online at: ${verifyUrl}`, 280, footerY + 20, { align: 'center' });

  doc.end();
}

// --- ROUTES ---
router.get('/', async (req, res) => { try { const paystubs = await Paystub.find().populate('employee').sort({ payDate: -1 }); res.json(paystubs); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/by-payroll/:runId', async (req, res) => { try { const stub = await Paystub.findOne({ payrollRun: req.params.runId }).populate('employee'); res.json(stub || {}); } catch (err) { res.status(500).json({ error: err.message }); } });

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
