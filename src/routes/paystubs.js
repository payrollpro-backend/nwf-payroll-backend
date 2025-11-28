// routes/paystubs.js
const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

// Load payrollRun model if available
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
        <img src="https://cdn.shopify.com/s/files/1/0970/4882/2041/files/NWF_logo_for_paystubs.png?v=1764193030" />
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
    res.status(500).json({ message: 'Server error fetching paystubs' });
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

    const stubs = await Paystub.find({ employee: employee._id }).sort({ payDate: -1 });
    res.json(stubs);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching employee paystubs' });
  }
});

// HTML preview
router.get('/:id/html', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id)
      .populate('employee', 'firstName lastName email externalEmployeeId');

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
    res.status(500).send('Error building paystub HTML');
  }
});

// PDF generation (pdfkit)
router.get('/:id/pdf', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id)
      .populate('employee', 'firstName lastName email externalEmployeeId');

    if (!stub) return res.status(404).send('Paystub not found');

    const payrollRunDoc =
      PayrollRun && stub.payrollRun
        ? await PayrollRun.findById(stub.payrollRun)
        : null;

    const employee = stub.employee || {};
    const firstName = employee.firstName || '';
    const lastName = employee.lastName || '';
    const email = employee.email || '';
    const externalEmployeeId = employee.externalEmployeeId || '';
    const employeeFullName = `${firstName} ${lastName}`.trim();

    const payDate = stub.payDate
      ? new Date(stub.payDate).toISOString().slice(0, 10)
      : '';

    const gross = stub.grossPay || 0;
    const net = stub.netPay || 0;
    const fed = stub.federalIncomeTax || 0;
    const state = stub.stateIncomeTax || 0;
    const ss = stub.socialSecurity || 0;
    const med = stub.medicare || 0;
    const totalTaxes = stub.totalTaxes || fed + state + ss + med;

    const ytdGross = stub.ytdGross || 0;
    const ytdNet = stub.ytdNet || 0;
    const ytdFed = stub.ytdFederalIncomeTax || 0;
    const ytdState = stub.ytdStateIncomeTax || 0;
    const ytdSs = stub.ytdSocialSecurity || 0;
    const ytdMed = stub.ytdMedicare || 0;
    const ytdTotalTaxes =
      stub.ytdTotalTaxes || ytdFed + ytdState + ytdSs + ytdMed;

    const fileName = stub.fileName || `nwf_${externalEmployeeId}_${payDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    doc.pipe(res);

    // Header
    doc.fontSize(16).text('NWF PAYROLL SERVICES', { align: 'left' });
    doc.fontSize(10).text('PAYROLL SERVICES', { align: 'left' });
    doc.moveDown(1.5);

    // Payee
    doc
      .fontSize(10)
      .text('Pay ________________________________ Dollars')
      .moveDown(0.3)
      .text(`To The ${employeeFullName}`)
      .moveDown(0.2)
      .text(`Order Of: ${employeeFullName}`)
      .moveDown(0.2)
      .text(email);

    doc.moveDown(0.5);
    doc.moveTo(36, doc.y).lineTo(576, doc.y).stroke();
    doc.moveDown(0.5);

    // Company & Employee
    const companyName = 'NSE MANAGEMENT INC';
    const companyAddressLine1 = '4711 Nutmeg Way SW';
    const companyAddressLine2 = 'Lilburn, GA 30047';

    doc
      .fontSize(11)
      .text(companyName)
      .fontSize(10)
      .text(employeeFullName)
      .text(`Employee ID: ${externalEmployeeId}`);

    doc.moveDown(1);

    // Earnings & Deductions
    const startY = doc.y + 5;

    doc.fontSize(9).text('Earnings', 36, startY);
    doc.text('Current', 300, startY);
    doc.text('YTD', 380, startY);

    let y = startY + 15;

    doc.text('Regular', 36, y);
    doc.text(gross.toFixed(2), 300, y);
    doc.text(ytdGross.toFixed(2), 380, y);

    y += 20;

    doc.text('Deductions:', 36, y);
    y += 12;

    const drawDeduction = (label, cur, ytd) => {
      doc.text(label, 36, y);
      doc.text(`(${cur.toFixed(2)})`, 300, y);
      doc.text(`(${ytd.toFixed(2)})`, 380, y);
      y += 12;
    };

    drawDeduction('Federal Income Tax', fed, ytdFed);
    drawDeduction('State Tax', state, ytdState);
    drawDeduction('Social Security', ss, ytdSs);
    drawDeduction('Medicare', med, ytdMed);

    // Net pay
    y += 20;
    doc.fontSize(12).text(`Net Pay: $${net.toFixed(2)}`, 36, y);

    // Footer
    y += 30;
    doc.fontSize(9).text(companyName, 36, y);
    doc.text(companyAddressLine1);
    doc.text(companyAddressLine2);

    doc.end();
  } catch (err) {
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
    if (!stub) return res.status(404).json({ message: 'Paystub not found' });
    res.json(stub);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching paystub' });
  }
});

module.exports = router;
