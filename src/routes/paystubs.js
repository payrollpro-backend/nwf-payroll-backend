// src/routes/paystubs.js
const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const { generateAdpPaystubPdf } = require('../services/paystubPdf');

f
const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

// Load PayrollRun model if available
let PayrollRun;
try {
  PayrollRun = require('../models/PayrollRun');
} catch (e) {
  PayrollRun = null;
}

const router = express.Router();

/* ----------------------------------------
   Helpers
---------------------------------------- */

function formatCurrency(value) {
  const num = typeof value === 'number' ? value : Number(value || 0);
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

// HTML builder (for /:id/html preview, not used for PDF)
function buildPaystubHtml({ stub, employee, payrollRun }) {
  const firstName = (employee && employee.firstName) || '';
  const lastName = (employee && employee.lastName) || '';
  const email = (employee && employee.email) || '';
  const externalEmployeeId = (employee && employee.externalEmployeeId) || '';

  const employeeFullName = `${firstName} ${lastName}`.trim();

  const payDate = formatDate(stub.payDate);
  const periodBegin = payrollRun ? formatDate(payrollRun.periodStart) : '';
  const periodEnd = payrollRun ? formatDate(payrollRun.periodEnd) : '';

  // Company info
  const companyName = 'NSE MANAGEMENT INC';
  const companyAddressLine1 = '4711 Nutmeg Way SW';
  const companyAddressLine2 = 'Lilburn, GA 30047';

  const gross = stub.grossPay || 0;
  const net = stub.netPay || 0;
  const fed = stub.federalIncomeTax || 0;
  const state = stub.stateIncomeTax || 0;
  const ss = stub.socialSecurity || 0;
  const med = stub.medicare || 0;
  const totalTaxes = stub.totalTaxes || (fed + state + ss + med);

  const ytdGross = stub.ytdGross || 0;
  const ytdNet = stub.ytdNet || 0;
  const ytdFed = stub.ytdFederalIncomeTax || 0;
  const ytdState = stub.ytdStateIncomeTax || 0;
  const ytdSs = stub.ytdSocialSecurity || 0;
  const ytdMed = stub.ytdMedicare || 0;
  const ytdTotalTaxes =
    stub.ytdTotalTaxes || (ytdFed + ytdState + ytdSs + ytdMed);

  const hours = stub.hoursWorked || 0;
  const rate = stub.hourlyRate || 0;

  const netFormatted = formatCurrency(net);

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Paystub ${employeeFullName} - ${payDate}</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; }
    body { margin: 0; padding: 24px; font-size: 11px; color: #000; }
    .page { width: 100%; max-width: 800px; margin: 0 auto; }

    .logo { display: flex; align-items: center; gap: 8px; }
    .logo img { height: 32px; }

    .row { display: flex; justify-content: space-between; }
    .section { margin-bottom: 18px; }
    .brand { font-weight: 700; font-size: 16px; letter-spacing: 1px; }
    .sub-brand { font-size: 10px; }

    .check-meta { font-size: 11px; text-align:right; }
    .check-meta table { border-collapse: collapse; }
    .check-meta td { padding: 2px 4px; }

    .line { border-bottom: 1px solid #000; margin: 8px 0; }
    .label { font-weight: 600; }

    table { border-collapse: collapse; width: 100%; }
    th,td { padding: 3px 4px; border-bottom: 1px solid #ddd; }
    th { font-weight: 600; text-align:left; border-bottom: 1px solid #000; }

    .right { text-align:right; }
    .net-pay-line { margin-top:10px; display:flex; justify-content:flex-end; font-size:12px; }
    .net-pay-line span { margin-left:6px; }

    .stub-block { margin-top:18px; padding-top:8px; border-top:1px dashed #aaa; }
    .small { font-size:10px; }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="section row">
      <div class="logo">
        <img src="https://cdn.shopify.com/s/files/1/0970/4882/2041/files/NWF_BRANDED_LOGO.png?v=1764317298" />
        <div>
          <div class="brand">NWF PAYROLL SERVICES</div>
          <div class="sub-brand">PAYROLL SERVICES</div>
        </div>
      </div>
      <div class="check-meta">
        <table>
          <tr><td class="label">Check Date</td><td>${payDate}</td></tr>
          <tr><td class="label">Amount</td><td>${netFormatted}</td></tr>
        </table>
      </div>
    </div>

    <!-- Payee section -->
    <div class="section">
      <div><span class="label">Pay</span> ________________________________ Dollars</div>
      <div style="margin-top:6px;"><span class="label">To The</span> ${employeeFullName}</div>
      <div><span class="label">Order Of:</span> ${employeeFullName}</div>
      <div>${email}</div>
    </div>

    <div class="line"></div>

    <!-- Stub section -->
    <div class="section">
      <div class="label">${companyName}</div>
      <div>${employeeFullName}</div>
      <div>Employee ID: ${externalEmployeeId}</div>

      <div class="row" style="margin-top:8px;">
        <!-- Earnings -->
        <div style="width:55%; padding-right:8px;">
          <table>
            <thead>
              <tr>
                <th>Earnings</th>
                <th class="right">Hours</th>
                <th class="right">Rate</th>
                <th class="right">Current</th>
                <th class="right">YTD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Regular</td>
                <td class="right">${hours ? hours.toFixed(2) : ''}</td>
                <td class="right">${rate ? rate.toFixed(2) : ''}</td>
                <td class="right">${formatCurrency(gross)}</td>
                <td class="right">${formatCurrency(ytdGross)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Deductions -->
        <div style="width:45%; padding-left:8px;">
          <table>
            <thead>
              <tr>
                <th>Deductions From Gross:</th>
                <th class="right">Current</th>
                <th class="right">YTD</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Gross</td><td class="right">${formatCurrency(gross)}</td><td class="right">${formatCurrency(ytdGross)}</td></tr>
              <tr><td>Federal Income Tax</td><td class="right">(${formatCurrency(fed)})</td><td class="right">(${formatCurrency(ytdFed)})</td></tr>
              <tr><td>Social Security</td><td class="right">(${formatCurrency(ss)})</td><td class="right">(${formatCurrency(ytdSs)})</td></tr>
              <tr><td>Medicare</td><td class="right">(${formatCurrency(med)})</td><td class="right">(${formatCurrency(ytdMed)})</td></tr>
              <tr><td>State Tax</td><td class="right">(${formatCurrency(state)})</td><td class="right">(${formatCurrency(ytdState)})</td></tr>
              <tr><td><strong>Total Taxes</strong></td><td class="right"><strong>(${formatCurrency(totalTaxes)})</strong></td><td class="right"><strong>(${formatCurrency(ytdTotalTaxes)})</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="net-pay-line"><span class="label">Net Pay:</span><span>${netFormatted}</span></div>

      <div class="small" style="margin-top:6px;">
        Check Date: ${payDate}
        ${periodBegin && periodEnd ? `&nbsp;&nbsp; Pay Period: ${periodBegin} - ${periodEnd}` : ''}
      </div>
    </div>

  </div>
</body>
</html>
`;
}

/* ----------------------------------------
   ROUTES
---------------------------------------- */

// Admin: list all paystubs
router.get('/', async (req, res) => {
  try {
    const paystubs = await Paystub.find()
      .populate('employee', 'firstName lastName email externalEmployeeId')
      .sort({ payDate: -1 });

    res.json(paystubs);
  } catch (err) {
    console.error('Error fetching paystubs:', err);
    res.status(500).json({ message: 'Server error fetching paystubs' });
  }
});
router.get('/paystubs/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const paystub = await Paystub.findById(id).populate('employee');

    if (!paystub) {
      return res.status(404).json({ message: 'Paystub not found' });
    }

    const pdfBuffer = await generateAdpPaystubPdf(paystub);

    const payDate =
      paystub.payDate instanceof Date
        ? paystub.payDate.toISOString().slice(0, 10) // YYYY-MM-DD
        : 'paydate';

    const employeeIdSafe = (
      paystub.employee.externalEmployeeId ||
      paystub.employee._id.toString()
    ).replace(/[^a-zA-Z0-9_-]/g, '');

    const fileName = `nwf_${employeeIdSafe}_${payDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName}"`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating paystub PDF (ADP-style):', err);
    return res.status(500).json({ message: 'Error generating paystub PDF' });
  }
});


// Employee: list paystubs by employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const query = mongoose.Types.ObjectId.isValid(employeeId)
      ? { _id: employeeId }
      : { externalEmployeeId: employeeId };

    const employee = await Employee.findOne(query);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const stubs = await Paystub.find({ employee: employee._id }).sort({
      payDate: -1,
    });
    res.json(stubs);
  } catch (err) {
    console.error('Error fetching paystubs by employee:', err);
    res.status(500).json({ message: 'Server error fetching employee paystubs' });
  }
});

// HTML preview
router.get('/:id/html', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) return res.status(404).send('Paystub not found');

    const payrollRunDoc =
      PayrollRun && stub.payrollRun
        ? await PayrollRun.findById(stub.payrollRun)
        : null;

    const html = buildPaystubHtml({
      stub,
      employee: stub.employee,
      payrollRun: payrollRunDoc,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error building paystub HTML:', err);
    res.status(500).send('Error building paystub HTML');
  }
});

// PDF generation (pdfkit) – ADP-style check + earnings stub
router.get('/:id/pdf', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) {
      return res.status(404).send('Paystub not found');
    }

    const payrollRunDoc =
      PayrollRun && stub.payrollRun
        ? await PayrollRun.findById(stub.payrollRun)
        : null;

    const employee = stub.employee || {};
    const firstName = employee.firstName || '';
    const lastName = employee.lastName || '';
    const email = employee.email || '';
    const externalEmployeeId = employee.externalEmployeeId || '';
    const employeeFullName = `${firstName} ${lastName}`.trim() || 'Employee';

    // Company block
    const companyName = 'NSE MANAGEMENT INC';
    const companyAddressLine1 = '4711 Nutmeg Way SW';
    const companyAddressLine2 = 'Lilburn, GA 30047';

    // Pay + tax data
    const payDateStr = stub.payDate
      ? new Date(stub.payDate).toISOString().slice(0, 10)
      : '';

    const gross = Number(stub.grossPay || 0);
    const net = Number(stub.netPay || 0);
    const fed = Number(stub.federalIncomeTax || 0);
    const state = Number(stub.stateIncomeTax || 0);
    const ss = Number(stub.socialSecurity || 0);
    const med = Number(stub.medicare || 0);
    const totalTaxes = Number(
      stub.totalTaxes || fed + state + ss + med
    );

    const ytdGross = Number(stub.ytdGross || 0);
    const ytdNet = Number(stub.ytdNet || 0);
    const ytdFed = Number(stub.ytdFederalIncomeTax || 0);
    const ytdState = Number(stub.ytdStateIncomeTax || 0);
    const ytdSs = Number(stub.ytdSocialSecurity || 0);
    const ytdMed = Number(stub.ytdMedicare || 0);
    const ytdTotalTaxes = Number(
      stub.ytdTotalTaxes || ytdFed + ytdState + ytdSs + ytdMed
    );

    const hours = Number(stub.hoursWorked || 0);
    const rate = Number(stub.hourlyRate || 0);

    const fileName =
      stub.fileName ||
      `nwf_${externalEmployeeId || 'employee'}_${payDateStr || 'date'}.pdf`;

    const formatNum = (n) => Number(n || 0).toFixed(2);

    const verificationCode = (stub.verificationCode || '').toString();
    const baseVerifyUrl =
      process.env.NWF_VERIFY_BASE_URL ||
      'https://nwf-payroll-backend.onrender.com/api/verify-paystub';
    const verificationUrl = verificationCode
      ? `${baseVerifyUrl}/${verificationCode}`
      : baseVerifyUrl;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    doc.pipe(res);

    // =======================
    // TOP CHECK AREA (ADP-like)
    // =======================
    let y = 36;

    // Brand block
    doc.fontSize(16).text('NWF PAYROLL SERVICES', 36, y);
    y += 16;
    doc.fontSize(9).text('PAYROLL SERVICES', 36, y);

    // Check info box (right)
    doc.fontSize(9);
    doc.text('Check Date:', 400, 40);
    doc.text(payDateStr || '—', 480, 40);
    doc.text('Amount:', 400, 55);
    doc.text(`$${formatNum(net)}`, 480, 55);

    // Payee lines
    y = 82;
    doc.fontSize(10).text('Pay to the Order of', 36, y);
    doc.moveTo(140, y + 10).lineTo(380, y + 10).stroke();
    doc.text(employeeFullName, 145, y);

    // Written amount placeholder
    y += 24;
    doc.text('Amount in Words', 36, y);
    doc.moveTo(120, y + 10).lineTo(560, y + 10).stroke();

    // Memo + signature
    y += 28;
    doc.text('Memo', 36, y);
    doc.moveTo(70, y + 10).lineTo(320, y + 10).stroke();

    doc.text('AUTHORIZED SIGNATURE', 360, y + 12, { align: 'right' });
    doc.moveTo(320, y + 10).lineTo(560, y + 10).stroke();

    // Tear line
    y += 40;
    doc.moveTo(36, y).lineTo(576, y).stroke();

    // =======================
    // BOTTOM EARNINGS STUB
    // =======================
    y += 16;

    // Employer + employee info
    doc.fontSize(10).text(companyName, 36, y);
    y += 12;
    doc.text(companyAddressLine1, 36, y);
    y += 12;
    doc.text(companyAddressLine2, 36, y);

    // Employee block on right
    const empBlockTop = y - 24;
    doc.text(employeeFullName, 360, empBlockTop);
    doc.text(`Employee ID: ${externalEmployeeId || '—'}`, 360, empBlockTop + 12);
    doc.text(email || '—', 360, empBlockTop + 24);

    // Pay period info under employee block if we have payrollRun
    let rY = empBlockTop + 42;
    if (
      payrollRunDoc &&
      payrollRunDoc.periodStart &&
      payrollRunDoc.periodEnd
    ) {
      const pb = new Date(payrollRunDoc.periodStart)
        .toISOString()
        .slice(0, 10);
      const pe = new Date(payrollRunDoc.periodEnd)
        .toISOString()
        .slice(0, 10);
      doc.fontSize(9).text('Pay Period:', 360, rY);
      doc.text(`${pb} - ${pe}`, 430, rY);
    }

    // Move cursor down a bit
    y += 40;

    // === Earnings table header ===
    const earnHeaderY = y;
    doc.fontSize(9).text('EARNINGS', 36, earnHeaderY);
    doc.text('Rate', 210, earnHeaderY, { width: 60, align: 'right' });
    doc.text('Hours', 270, earnHeaderY, { width: 60, align: 'right' });
    doc.text('This Period', 330, earnHeaderY, { width: 80, align: 'right' });
    doc.text('YTD', 410, earnHeaderY, { width: 80, align: 'right' });

    y = earnHeaderY + 14;

    // Regular Pay row
    doc.text('Regular Pay', 36, y);
    doc.text(formatNum(rate), 210, y, { width: 60, align: 'right' });
    doc.text(hours ? hours.toFixed(2) : '', 270, y, {
      width: 60,
      align: 'right',
    });
    doc.text(formatNum(gross), 330, y, { width: 80, align: 'right' });
    doc.text(formatNum(ytdGross), 410, y, { width: 80, align: 'right' });

    // Total earnings row
    y += 16;
    doc.fontSize(9).text('Total Earnings', 36, y);
    doc.text(formatNum(gross), 330, y, { width: 80, align: 'right' });
    doc.text(formatNum(ytdGross), 410, y, { width: 80, align: 'right' });

    // === Deductions header ===
    y += 24;
    const dedHeaderY = y;
    doc.fontSize(9).text('DEDUCTIONS', 36, dedHeaderY);
    doc.text('Current', 330, dedHeaderY, { width: 80, align: 'right' });
    doc.text('YTD', 410, dedHeaderY, { width: 80, align: 'right' });

    y = dedHeaderY + 14;

    const drawDed = (label, cur, ytd) => {
      doc.text(label, 36, y);
      doc.text(`(${formatNum(cur)})`, 330, y, { width: 80, align: 'right' });
      doc.text(`(${formatNum(ytd)})`, 410, y, { width: 80, align: 'right' });
      y += 12;
    };

    drawDed('Federal Income Tax', fed, ytdFed);
    drawDed('Social Security (Employee)', ss, ytdSs);
    drawDed('Medicare (Employee)', med, ytdMed);
    drawDed('State Income Tax', state, ytdState);

    // Total taxes row
    y += 4;
    doc.fontSize(9).text('Total Taxes', 36, y);
    doc.text(`(${formatNum(totalTaxes)})`, 330, y, {
      width: 80,
      align: 'right',
    });
    doc.text(`(${formatNum(ytdTotalTaxes)})`, 410, y, {
      width: 80,
      align: 'right',
    });

    // === Net Pay summary ===
    y += 24;
    doc.fontSize(10).text('Net Pay This Period:', 36, y);
    doc.text(`$${formatNum(net)}`, 170, y, { width: 80, align: 'right' });

    y += 16;
    doc.fontSize(9).text('YTD Net Pay:', 36, y);
    doc.text(`$${formatNum(ytdNet)}`, 170, y, { width: 80, align: 'right' });

    // ===== Company Footer Block (ADP-Style) =====
    y += 32;
    doc
      .fontSize(9)
      .fillColor('#111827')
      .text(companyName, 36, y);

    doc.moveDown(0.2);
    doc
      .fontSize(8)
      .fillColor('#4B5563')
      .text(companyAddressLine1, 36, doc.y);
    doc
      .fontSize(8)
      .text(companyAddressLine2, 36, doc.y);

    doc.moveDown(0.3);
    doc
      .fontSize(7)
      .fillColor('#6B7280')
      .text(
        'This statement has been prepared by NWF Payroll Services.',
        36,
        doc.y
      );

    doc.moveDown(1.2);

    // ===== Verification Block =====
    if (verificationCode) {
      doc
        .fontSize(8)
        .fillColor('#6B7280')
        .text('Verification', 36, doc.y);

      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor('#111827')
        .text(`Code: ${verificationCode}`, 36, doc.y);

      doc.moveDown(0.3);
      doc
        .fontSize(8)
        .fillColor('#6B7280')
        .text('Verify online at:', 36, doc.y);
      doc
        .fontSize(9)
        .fillColor('#111827')
        .text(verificationUrl, 120, doc.y - 2);
    }

    // Reset color and finalize
    doc.fillColor('#000000');
    doc.end();
  } catch (err) {
    console.error('Error generating paystub PDF (ADP-style):', err);
    res.status(500).send('Error generating paystub PDF');
  }
});

// Get single stub JSON
router.get('/:id', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );
    if (!stub) {
      return res.status(404).json({ message: 'Paystub not found' });
    }
    res.json(stub);
  } catch (err) {
    console.error('Error fetching paystub by id:', err);
    res.status(500).json({ message: 'Server error fetching paystub' });
  }
});

module.exports = router;
