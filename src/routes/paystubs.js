// routes/paystubs.js (example)
const express = require('express');
const PDFDocument = require('pdfkit');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Paystub = require('../models/Paystub');

const router = express.Router();

router.get('/:paystubId/pdf', async (req, res) => {
  try {
    const paystub = await Paystub.findById(req.params.paystubId)
      .populate('employee')
      .populate('payrollRun');

    if (!paystub) {
      return res.status(404).send('Paystub not found');
    }

    const employee = paystub.employee;
    const pr = paystub.payrollRun;

    // Create PDF
    const doc = new PDFDocument({ margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${paystub.fileName || 'paystub.pdf'}"`
    );

    doc.pipe(res);

    // ============================
    //  HEADER – Employer + Logo
    // ============================
    // If you have the logo on disk, you can do doc.image(...)
    doc
      .fontSize(14)
      .text('NWF PAYROLL SERVICES', { align: 'left' })
      .fontSize(10)
      .text('NWF Property Management', { align: 'left' })
      .text('123 Business Street', { align: 'left' })
      .text('Atlanta, GA 30303', { align: 'left' })
      .moveDown(1);

    // Employee info on the right
    const empName = `${employee.firstName} ${employee.lastName}`.trim();
    const addr = employee.address || {};

    doc
      .fontSize(12)
      .text('PAY STATEMENT', { align: 'right' })
      .moveDown(0.5)
      .fontSize(9)
      .text(empName, { align: 'right' })
      .text(addr.line1 || '', { align: 'right' })
      .text(
        [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
        { align: 'right' }
      )
      .moveDown(1);

    // Employee ID and period / pay dates
    const empId = employee.externalEmployeeId || '';
    const periodStart = pr.periodStart
      ? new Date(pr.periodStart).toLocaleDateString()
      : '';
    const periodEnd = pr.periodEnd
      ? new Date(pr.periodEnd).toLocaleDateString()
      : '';
    const payDate = pr.payDate
      ? new Date(pr.payDate).toLocaleDateString()
      : '';

    doc
      .fontSize(9)
      .text(`Employee ID: ${empId}`, { align: 'left' })
      .text(`Pay Period: ${periodStart} - ${periodEnd}`, { align: 'left' })
      .text(`Pay Date: ${payDate}`, { align: 'left' })
      .moveDown(1);

    // ============================
    //  EARNINGS SECTION
    // ============================
    const currentGross = pr.grossPay || 0;
    const ytdGross = pr.ytdGrossPay || 0;
    const currentHours = pr.hoursWorked || 0;
    const rate = pr.hourlyRate || 0;

    doc
      .fontSize(10)
      .text('EARNINGS', { underline: true })
      .moveDown(0.3);

    doc
      .fontSize(9)
      .text(
        'Description',
        50,
        doc.y,
        { continued: true }
      )
      .text('Hours', 200, doc.y, { continued: true })
      .text('Rate', 260, doc.y, { continued: true })
      .text('Current', 320, doc.y, { continued: true })
      .text('YTD', 400, doc.y)
      .moveDown(0.2);

    doc
      .text(
        'Regular Pay',
        50,
        doc.y,
        { continued: true }
      )
      .text(currentHours.toFixed(2), 200, doc.y, { continued: true })
      .text(`$${rate.toFixed(2)}`, 260, doc.y, { continued: true })
      .text(`$${currentGross.toFixed(2)}`, 320, doc.y, { continued: true })
      .text(`$${ytdGross.toFixed(2)}`, 400, doc.y)
      .moveDown(1);

    // ============================
    //  TAXES / DEDUCTIONS SECTION
    // ============================
    const currentFed = pr.federalIncomeTax || 0;
    const currentState = pr.stateIncomeTax || 0;
    const currentSS = pr.socialSecurity || 0;
    const currentMed = pr.medicare || 0;
    const currentTotalTaxes = pr.totalTaxes || 0;
    const currentNet = pr.netPay || 0;

    const ytdFed = pr.ytdFederalIncomeTax || 0;
    const ytdState = pr.ytdStateIncomeTax || 0;
    const ytdSS = pr.ytdSocialSecurity || 0;
    const ytdMed = pr.ytdMedicare || 0;
    const ytdTotalTaxes = pr.ytdTotalTaxes || 0;
    const ytdNet = pr.ytdNetPay || 0;

    doc
      .fontSize(10)
      .text('TAXES & DEDUCTIONS', { underline: true })
      .moveDown(0.3);

    doc
      .fontSize(9)
      .text('Description', 50, doc.y, { continued: true })
      .text('Current', 320, doc.y, { continued: true })
      .text('YTD', 400, doc.y)
      .moveDown(0.2);

    function line(label, current, ytd) {
      doc
        .text(label, 50, doc.y, { continued: true })
        .text(`$${current.toFixed(2)}`, 320, doc.y, { continued: true })
        .text(`$${ytd.toFixed(2)}`, 400, doc.y)
        .moveDown(0.1);
    }

    line('Federal Income Tax', currentFed, ytdFed);
    line('State Income Tax', currentState, ytdState);
    line('Social Security', currentSS, ytdSS);
    line('Medicare', currentMed, ytdMed);

    doc.moveDown(0.5);
    line('Total Taxes', currentTotalTaxes, ytdTotalTaxes);

    doc.moveDown(0.8);
    line('Net Pay', currentNet, ytdNet);

    // Footer note
    doc.moveDown(1.5);
    doc
      .fontSize(8)
      .fillColor('#555555')
      .text(
        'This stub reflects earnings and tax information for the stated pay period and year-to-date as of the pay date.',
        { align: 'left' }
      );

    doc.end();
  } catch (err) {
    console.error('paystub pdf error:', err);
    res.status(500).send('Failed to generate paystub PDF');
  }
});

module.exports = router;
