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
  // Rates approximated from your output
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

  // --- DATA PREP ---
  const emp = paystub.employee || {};
  const gross = paystub.grossPay || 0;
  
  // Use DB values if they exist, otherwise calc
  const taxes = calculateGaTaxes(gross);
  const net = paystub.netPay || taxes.net;
  
  // If taxes are stored in DB, use them. Else use calc.
  const fedVal = paystub.federalIncomeTax || taxes.fed;
  const stateVal = paystub.stateIncomeTax || taxes.state;
  const ssVal = paystub.socialSecurity || taxes.ss;
  const medVal = paystub.medicare || taxes.med;

  // YTD Logic (Use stored or project)
  const ytdGross = paystub.ytdGross || gross;
  const ytdFed = paystub.ytdFederalIncomeTax || fedVal;
  const ytdState = paystub.ytdStateIncomeTax || stateVal;
  const ytdSS = paystub.ytdSocialSecurity || ssVal;
  const ytdMed = paystub.ytdMedicare || medVal;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString();
  
  const checkDate = formatDate(paystub.payDate);
  const periodStart = formatDate(paystub.periodStart || paystub.payPeriodStart);
  const periodEnd = formatDate(paystub.periodEnd || paystub.payPeriodEnd);

  const empName = `${emp.lastName || 'EMPLOYEE'}, ${emp.firstName || 'NAME'}`.toUpperCase();
  const empAddr1 = (emp.address?.line1 || "").toUpperCase();
  const empAddr2 = `${emp.address?.city || ''}, ${emp.address?.state || ''} ${emp.address?.zip || ''}`.toUpperCase();
  
  // FIX: Fallback to partial ID if external ID is missing
  const empId = emp.externalEmployeeId || `EMP-${emp._id.toString().slice(-6).toUpperCase()}`;

  const coName = "NWF PAYROLL SERVICES"; 
  const coAddr1 = "4711 NUTMEG WAY SW";
  const coAddr2 = "LILBURN, GA 30047";

  // --- DRAWING ---

  // 1. TOP CHECK SECTION
  // Adjusted coordinates to prevent text overlapping
  doc.font('Helvetica-Bold').fontSize(18).text('NWF', 40, 40);
  doc.fontSize(8).text('PAYROLL SERVICES', 40, 60);

  // Date & Amount Block (Top Right)
  doc.font('Helvetica').fontSize(10);
  
  // Box labels
  doc.text('Check Date', 450, 50, { align: 'right', width: 70 });
  doc.text('Amount', 530, 50, { align: 'right', width: 70 });
  
  // Box Values
  doc.font('Helvetica-Bold');
  doc.text(checkDate, 450, 65, { align: 'right', width: 70 }); 
  doc.text(fmt(net), 530, 65, { align: 'right', width: 70 });

  // "Pay" Line
  const payY = 120;
  doc.font('Helvetica-Bold').fontSize(11).text('PAY', 40, payY);
  
  // Amount Text
  const amountTxt = `*** ${fmt(net)} ***`; 
  doc.font('Courier-Bold').fontSize(12).text(amountTxt, 100, payY - 2);
  doc.font('Helvetica').fontSize(11).text('Dollars', 530, payY);
  
  doc.moveTo(90, payY + 10).lineTo(520, payY + 10).stroke(); 

  // "To The Order Of"
  const orderY = 150;
  doc.font('Helvetica-Bold').fontSize(10).text('TO THE', 40, orderY);
  doc.text('ORDER OF:', 40, orderY + 12);

  doc.font('Helvetica').fontSize(11).text(empName, 120, orderY - 5);
  doc.fontSize(10).text(empAddr1, 120, orderY + 12);
  doc.text(empAddr2, 120, orderY + 25);

  // Memo
  doc.font('Helvetica-Bold').text('MEMO', 40, 210);
  doc.font('Courier').text(`Payroll: ${periodEnd}`, 90, 210);
  doc.moveTo(80, 220).lineTo(300, 220).stroke();

  // Signature Line
  doc.moveTo(380, 220).lineTo(580, 220).stroke();
  doc.font('Helvetica').fontSize(7).text('AUTHORIZED SIGNATURE', 450, 225);

  // MICR Line (Bottom of Check)
  doc.font('Courier').fontSize(14).text(`A001234080A  1080C  ${fmt(net).replace('.','')}D`, 100, 260);

  // 2. STUBS (Middle and Bottom)
  drawStub(doc, 320, coName, empName, empId, checkDate, periodStart, periodEnd, gross, net, fedVal, stateVal, ssVal, medVal, ytdGross, ytdFed, ytdState, ytdSS, ytdMed);
  drawStub(doc, 580, coName, empName, empId, checkDate, periodStart, periodEnd, gross, net, fedVal, stateVal, ssVal, medVal, ytdGross, ytdFed, ytdState, ytdSS, ytdMed);

  // Footer Company Info
  doc.font('Helvetica-Bold').fontSize(10).text(coName, 40, 750);
  doc.font('Helvetica').fontSize(9).text(coAddr1, 40, 762);
  doc.text(coAddr2, 40, 773);

  // Bottom Net Pay
  doc.font('Helvetica-Bold').fontSize(11).text('Net Pay:', 450, 760);
  doc.fontSize(12).text(`$${fmt(net)}`, 500, 760);

  doc.end();
}

function drawStub(doc, startY, coName, empName, empId, checkDate, pStart, pEnd, gross, net, fed, state, ss, med, ytdGross, ytdFed, ytdState, ytdSS, ytdMed) {
  
  // Header Row
  doc.font('Helvetica-Bold').fontSize(9).text(coName, 40, startY);
  doc.text('1080', 550, startY); 

  // Employee Info Block
  const infoY = startY + 20;
  doc.font('Helvetica').text(empName, 40, infoY);
  doc.text(`ID: ${empId}`, 40, infoY + 12);

  // Date Block
  const dateX = 400;
  doc.text('Check Date:', dateX, infoY);       doc.text(checkDate, dateX + 80, infoY, { align: 'right', width: 70 });
  doc.text('Period Start:', dateX, infoY + 12); doc.text(pStart, dateX + 80, infoY + 12, { align: 'right', width: 70 });
  doc.text('Period End:', dateX, infoY + 24);   doc.text(pEnd, dateX + 80, infoY + 24, { align: 'right', width: 70 });

  // --- EARNINGS TABLE ---
  const tableY = startY + 60;
  
  // Headers
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Earnings', 40, tableY);
  doc.text('Current', 200, tableY, { align: 'right', width: 60 });
  doc.text('YTD', 280, tableY, { align: 'right', width: 60 });
  
  doc.text('Deductions', 380, tableY);
  doc.text('Current', 480, tableY, { align: 'right', width: 50 });
  doc.text('YTD', 540, tableY, { align: 'right', width: 50 });
  
  doc.moveTo(40, tableY + 12).lineTo(590, tableY + 12).stroke();

  // Rows
  let dy = tableY + 18;
  doc.font('Helvetica').fontSize(9);

  // Earnings Rows
  doc.text('Regular Pay', 40, dy);
  doc.text(fmt(gross), 200, dy, { align: 'right', width: 60 });
  doc.text(fmt(ytdGross), 280, dy, { align: 'right', width: 60 });

  // Deductions Rows
  const dedX = 380;
  const curX = 480;
  const ytdX = 540;

  const drawDed = (label, cur, ytd) => {
    doc.text(label, dedX, dy);
    doc.text(fmt(cur), curX, dy, { align: 'right', width: 50 });
    doc.text(fmt(ytd), ytdX, dy, { align: 'right', width: 50 });
    dy += 12;
  };

  drawDed('Federal Tax', fed, ytdFed);
  drawDed('State Tax', state, ytdState);
  drawDed('Social Security', ss, ytdSS);
  drawDed('Medicare', med, ytdMed);

  // Totals Line
  dy += 5;
  doc.moveTo(40, dy).lineTo(590, dy).stroke();
  dy += 5;
  
  doc.font('Helvetica-Bold');
  doc.text('NET PAY', 380, dy);
  doc.text(`$${fmt(net)}`, curX, dy, { align: 'right', width: 50 });
  // Calculate YTD Net for display
  const ytdNet = ytdGross - (ytdFed + ytdState + ytdSS + ytdMed);
  doc.text(`$${fmt(ytdNet)}`, ytdX, dy, { align: 'right', width: 50 });
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

router.get('/:id/pdf', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.id).populate('employee');
    if (!paystub) return res.status(404).send('Error: Paystub record not found in database.');
    await generateSinglePagePdf(paystub, res);
  } catch (err) {
    console.error('PDF Gen Error:', err);
    res.status(500).send(`Error generating PDF: ${err.message}`);
  }
});

module.exports = router;
