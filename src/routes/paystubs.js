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

// --- GA TAX FORMULA ---
function calculateGaTaxes(gross) {
  const safeGross = gross || 0;
  const fedRate = 0.1780;
  const gaRate = 0.0543;
  const ssRate = 0.062;
  const medRate = 0.0145;

  const fed = safeGross * fedRate;
  const state = safeGross * gaRate;
  const ss = safeGross * ssRate;
  const med = safeGross * medRate;
  
  return {
    fed, state, ss, med,
    total: fed + state + ss + med,
    net: safeGross - (fed + state + ss + med)
  };
}

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');

// --- PDF GENERATOR ---
async function generateSinglePagePdf(paystub, res) {
  if (!PDFDocument) throw new Error("PDFKit library missing on server.");

  const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${paystub.fileName || 'paystub.pdf'}"`);
  
  doc.pipe(res);

  // --- DATA PREP (With Safety Checks) ---
  const emp = paystub.employee || {};
  const gross = paystub.grossPay || 0;
  
  const taxes = calculateGaTaxes(gross);
  
  const net = taxes.net;
  const fedVal = taxes.fed;
  const stateVal = taxes.state;
  const ssVal = taxes.ss;
  const medVal = taxes.med;

  // YTD Logic
  const ytdGross = paystub.ytdGross || (gross * 10);
  const ytdFed = paystub.ytdFederalIncomeTax || (fedVal * 10);
  const ytdState = paystub.ytdStateIncomeTax || (stateVal * 10);
  const ytdSS = paystub.ytdSocialSecurity || (ssVal * 10);
  const ytdMed = paystub.ytdMedicare || (medVal * 10);

  // Dates
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '01/01/2025';
  
  const checkDate = formatDate(paystub.payDate);
  const periodStart = formatDate(paystub.periodStart || paystub.payPeriodStart);
  const periodEnd = formatDate(paystub.periodEnd || paystub.payPeriodEnd);

  // Employee Details (Defaults to prevent crash)
  const empName = `${emp.lastName || 'EMPLOYEE'}, ${emp.firstName || 'NAME'}`.toUpperCase();
  const empAddr1 = emp.address?.line1 || "ADDRESS NOT ON FILE";
  const empAddr2 = `${emp.address?.city || ''}, ${emp.address?.state || ''} ${emp.address?.zip || ''}`.toUpperCase();
  const empId = emp.externalEmployeeId || "N/A";

  // Company Info
  const coName = "NWF PAYROLL SERVICES"; 
  const coAddr1 = "4711 NUTMEG WAY SW";
  const coAddr2 = "LILBURN, GA 30047";

  // --- DRAWING ---

  // 1. TOP CHECK SECTION
  doc.font('Helvetica-Bold').fontSize(24).text('NWF', 40, 30);
  doc.fontSize(8).text('PAYROLL SERVICES', 40, 55);

  doc.font('Helvetica').fontSize(10);
  doc.text('Check Date', 600, 80, { align: 'right' });
  doc.text(checkDate, 500, 95); 
  
  doc.text('Amount', 500, 80, { align: 'right' });
  doc.text(fmt(net), 550, 95, { align: 'right' });

  // "Pay" Line
  const payY = 140;
  doc.font('Helvetica-Bold').text('Pay', 40, payY);
  const amountTxt = `*** ${fmt(net)} ***`; 
  doc.font('Helvetica-Bold').text(amountTxt, 100, payY);
  doc.text('Dollars', 530, payY);
  
  doc.moveTo(90, payY + 10).lineTo(520, payY + 10).stroke(); 

  // "To The Order Of"
  const orderY = 160;
  doc.font('Helvetica-Bold').text('To The', 40, orderY);
  doc.text('Order Of:', 40, orderY + 12);

  doc.font('Helvetica').text(empName, 100, orderY);
  doc.text(empAddr1, 100, orderY + 12);
  doc.text(empAddr2, 100, orderY + 24);

  // Memo
  doc.font('Helvetica-Bold').text('Memo', 40, 220);
  doc.moveTo(90, 230).lineTo(350, 230).stroke();

  // Signature
  doc.moveTo(400, 230).lineTo(580, 230).stroke();
  doc.font('Helvetica').fontSize(8).text('AUTHORIZED SIGNATURE', 430, 235);

  // MICR
  doc.font('Courier').fontSize(12).text(`"001234080"`, 180, 260);

  // 2. STUBS
  drawStub(doc, 320, coName, empName, empId, checkDate, periodStart, periodEnd, gross, net, fedVal, stateVal, ssVal, medVal, ytdGross, ytdFed, ytdState, ytdSS, ytdMed);
  drawStub(doc, 580, coName, empName, empId, checkDate, periodStart, periodEnd, gross, net, fedVal, stateVal, ssVal, medVal, ytdGross, ytdFed, ytdState, ytdSS, ytdMed);

  // Footer
  doc.font('Helvetica-Bold').fontSize(12).text(coName, 40, 750);
  doc.font('Helvetica').fontSize(10).text(coAddr1, 40, 765);
  doc.text(coAddr2, 40, 778);

  doc.font('Helvetica').text('Net Pay:', 450, 780);
  doc.text('$', 520, 780);
  doc.text(fmt(net), 540, 780);

  doc.end();
}

function drawStub(doc, startY, coName, empName, empId, checkDate, pStart, pEnd, gross, net, fed, state, ss, med, ytdGross, ytdFed, ytdState, ytdSS, ytdMed) {
  
  doc.font('Helvetica-Bold').fontSize(10).text(coName, 40, startY);
  doc.text('1080', 550, startY); 

  const infoY = startY + 25;
  doc.font('Helvetica').text(empName, 40, infoY);
  doc.text(`Employee ID:  ${empId}`, 40, infoY + 15);

  doc.text('Check Date:', 350, infoY);       doc.text(checkDate, 480, infoY);
  doc.text('Period Start:', 350, infoY + 12); doc.text(pStart, 480, infoY + 12);
  doc.text('Period End:', 350, infoY + 24);    doc.text(pEnd, 480, infoY + 24);

  const tableY = startY + 70;
  
  doc.font('Helvetica').text('Earnings', 40, tableY);
  doc.text('Current', 250, tableY);
  doc.text('YTD', 320, tableY);
  doc.moveTo(40, tableY + 12).lineTo(380, tableY + 12).stroke();

  doc.text('Regular', 40, tableY + 15);
  doc.text(fmt(gross), 250, tableY + 15);
  doc.text(fmt(ytdGross), 320, tableY + 15);

  const dedX = 390;
  doc.text('Deductions:', dedX, tableY);
  doc.text('Current', 500, tableY);
  doc.text('YTD', 560, tableY);
  doc.moveTo(dedX, tableY + 12).lineTo(600, tableY + 12).stroke();

  let dy = tableY + 15;
  const drawRow = (lbl, cur, ytd) => {
    doc.text(lbl, dedX, dy);
    doc.text(fmt(cur), 500, dy);
    doc.text(fmt(ytd), 560, dy);
    dy += 12;
  };

  drawRow('Fed Tax', fed, ytdFed);
  drawRow('State Tax', state, ytdState);
  drawRow('Soc Sec', ss, ytdSS);
  drawRow('Medicare', med, ytdMed);

  doc.text('Net Pay:', 350, dy + 20);
  doc.text('$', 480, dy + 20);
  doc.text(fmt(net), 500, dy + 20);
}


/* ----------------------------------------
   ROUTES
---------------------------------------- */

router.get('/', async (req, res) => {
  try {
    const paystubs = await Paystub.find().populate('employee').sort({ payDate: -1 });
    res.json(paystubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-payroll/:runId', async (req, res) => {
  try {
    const stub = await Paystub.findOne({ payrollRun: req.params.runId }).populate('employee');
    if (!stub) return res.status(404).json({ error: 'Not found' });
    res.json(stub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Generation Route
router.get('/:id/pdf', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.id).populate('employee');

    if (!paystub) return res.status(404).send('Error: Paystub record not found in database.');

    await generateSinglePagePdf(paystub, res);

  } catch (err) {
    console.error('PDF Gen Error:', err);
    // ✅ THIS IS THE FIX: Send the actual error message
    res.status(500).send(`Error generating PDF: ${err.message}`);
  }
});

module.exports = router;
