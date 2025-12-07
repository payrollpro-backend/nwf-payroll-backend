// src/routes/paystubs.js
const express = require('express');
const router = express.Router();
const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  console.error("⚠️ PDFKit is not installed. Run 'npm install pdfkit'");
}

// --- HELPERS ---
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'MM/DD/YYYY';

// --- TAX CALCULATOR FALLBACK ---
function calculateGaTaxes(gross) {
  const safeGross = gross || 0;
  // Fallback rates if DB is empty
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

  const doc = new PDFDocument({ size: 'LETTER', margin: 25 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="paystub-${paystub._id}.pdf"`);
  doc.pipe(res);

  // --- DATA PREP ---
  const emp = paystub.employee || {};
  const gross = paystub.grossPay || 0;
  const taxes = calculateGaTaxes(gross);
  const net = paystub.netPay || taxes.net;

  // Use stored values (DB) or fallback to calculator
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

  // Text Strings
  const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.toUpperCase();
  const empAddr1 = (emp.address?.line1 || "").toUpperCase();
  const empAddr2 = `${emp.address?.city || ''}, ${emp.address?.state || ''} ${emp.address?.zip || ''}`.toUpperCase();
  const empId = emp.externalEmployeeId || `EMP-${emp._id.toString().slice(-6).toUpperCase()}`;

  const coName = (emp.companyName || "NWF PAYROLL SERVICES").toUpperCase();
  const coAddr1 = "123 PAYROLL STREET"; 
  const coAddr2 = "ATLANTA, GA 30303";

  // ✅ VERIFICATION CODE (From your DB Model)
  const verifyCode = paystub.verificationCode || "PENDING";
  const verifyUrl = "https://nwfpayroll.com/verification.html";

  // Dates
  const checkDate = fmtDate(paystub.payDate);
  const pStart = fmtDate(paystub.periodStart || paystub.payPeriodStart);
  const pEnd = fmtDate(paystub.periodEnd || paystub.payPeriodEnd);

  // ======================================================
  // 1. TOP CHECK PORTION
  // ======================================================
  
  // Border
  doc.rect(25, 25, 560, 230).stroke();

  // Company (Left)
  doc.font('Helvetica-Bold').fontSize(11).text(coName, 40, 40);
  doc.font('Helvetica').fontSize(9).text(coAddr1, 40, 55);
  doc.text(coAddr2, 40, 68);

  // Check Meta (Right)
  doc.font('Helvetica-Bold').fontSize(12).text(paystub.checkNumber || '1080', 530, 40);
  
  doc.font('Helvetica-Bold').fontSize(10).text('DATE', 420, 70);
  doc.text('AMOUNT', 500, 70, { align: 'right', width: 70 });
  
  doc.font('Courier').fontSize(11);
  doc.text(checkDate, 420, 85);
  doc.text('$' + fmt(net), 500, 85, { align: 'right', width: 70 });

  // Pay Order
  const midY = 120;
  doc.font('Helvetica-Bold').fontSize(9).text('PAY TO THE', 40, midY);
  doc.text('ORDER OF', 40, midY + 12);

  doc.font('Courier-Bold').fontSize(12).text(empName, 110, midY + 5);
  doc.font('Courier').fontSize(10).text(empAddr1, 110, midY + 20);
  doc.text(empAddr2, 110, midY + 32);

  // Amount Text
  const payAmtY = 135;
  doc.font('Helvetica-Bold').fontSize(10).text(`*** ${fmt(net)} ***`, 400, payAmtY, { align: 'right', width: 170 });
  doc.font('Helvetica').fontSize(8).text('DOLLARS', 540, payAmtY + 12);

  // Bank Info
  doc.font('Helvetica-Bold').fontSize(9).text(paystub.bankName || 'FIRST NATIONAL BANK', 40, 190);
  
  // Signature
  doc.moveTo(350, 230).lineTo(560, 230).stroke();
  doc.font('Helvetica-Oblique').fontSize(8).text('Authorized Signature', 350, 235, { align: 'center', width: 210 });

  // MICR Line (Simulated)
  doc.font('Courier-Bold').fontSize(14).text(`A001234567A  ${paystub.checkNumber || '1080'}C  012345678C`, 100, 260);


  // ======================================================
  // 2. STUB DRAWING FUNCTION (Used Twice)
  // ======================================================
  function drawStub(startY) {
    // Header Bar
    doc.rect(25, startY, 560, 20).fill('#e5e7eb');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
    doc.text('EARNINGS STATEMENT', 40, startY + 6);
    doc.text(`Period: ${pStart} - ${pEnd}`, 200, startY + 6);
    doc.text(`Pay Date: ${checkDate}`, 450, startY + 6);

    // Columns
    const colY = startY + 30;
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('EARNINGS', 40, colY);
    doc.text('RATE', 180, colY, { align: 'right', width: 40 });
    doc.text('HOURS', 230, colY, { align: 'right', width: 40 });
    doc.text('CURRENT', 280, colY, { align: 'right', width: 50 });
    doc.text('YTD', 340, colY, { align: 'right', width: 60 });

    doc.text('DEDUCTIONS', 430, colY);
    doc.text('CURRENT', 500, colY, { align: 'right', width: 40 });
    doc.text('YTD', 550, colY, { align: 'right', width: 35 });
    
    // Divider Line
    doc.moveTo(25, colY + 10).lineTo(585, colY + 10).stroke();

    // --- DATA ROWS ---
    let rowY = colY + 20;
    doc.font('Helvetica').fontSize(9);

    // Earnings
    doc.text('Regular Pay', 40, rowY);
    doc.text('80.00', 230, rowY, { align: 'right', width: 40 });
    doc.text(fmt(gross), 280, rowY, { align: 'right', width: 50 });
    doc.text(fmt(ytdGross), 340, rowY, { align: 'right', width: 60 });

    // Deductions Loop
    const taxesList = [
        { label: 'Federal Income Tax', cur: fedVal, ytd: ytdFed },
        { label: 'Social Security', cur: ssVal, ytd: ytdSS },
        { label: 'Medicare', cur: medVal, ytd: ytdMed },
        { label: 'State Tax (GA)', cur: stateVal, ytd: ytdState },
    ];

    let taxY = rowY;
    taxesList.forEach(t => {
        doc.text(t.label, 430, taxY);
        doc.text(fmt(t.cur), 500, taxY, { align: 'right', width: 40 });
        doc.text(fmt(t.ytd), 550, taxY, { align: 'right', width: 35 });
        taxY += 12;
    });

    // --- FOOTER ---
    const totalY = startY + 120;
    doc.rect(25, totalY, 560, 25).fill('#f3f4f6');
    doc.fillColor('black');
    
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('NET PAY', 400, totalY + 8);
    doc.font('Courier-Bold').fontSize(12).text('$' + fmt(net), 480, totalY + 6);

    // ✅ VERIFICATION FOOTER
    doc.font('Helvetica').fontSize(8).fillColor('#555');
    doc.text(`VERIFY THIS DOCUMENT: ${verifyUrl}`, 40, totalY + 8);
    doc.font('Helvetica-Bold').fillColor('#000');
    doc.text(`CODE: ${verifyCode}`, 250, totalY + 8);
  }

  // Draw Middle Stub
  drawStub(300);

  // Cut Line
  doc.moveTo(25, 520).lineTo(585, 520).dash(5, { space: 5 }).stroke();
  doc.undash();

  // Draw Bottom Stub
  drawStub(550);

  doc.end();
}

// --- ROUTES ---

router.get('/', async (req, res) => {
  try {
    const paystubs = await Paystub.find().populate('employee').sort({ payDate: -1 });
    res.json(paystubs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-payroll/:runId', async (req, res) => {
  try {
    const stub = await Paystub.findOne({ payrollRun: req.params.runId }).populate('employee');
    if (!stub) return res.status(404).json({ error: 'Not found' });
    res.json(stub);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.id).populate('employee');
    if (!paystub) return res.status(404).send('Paystub record not found.');
    await generateSinglePagePdf(paystub, res);
  } catch (err) {
    console.error('PDF Error:', err);
    res.status(500).send(`Error generating PDF: ${err.message}`);
  }
});

module.exports = router;
