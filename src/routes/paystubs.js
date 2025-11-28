// routes/paystubs.js
const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit'); // ⬅ use pdfkit instead of puppeteer

const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

let PayrollRun;
try {
  PayrollRun = require('../models/PayrollRun');
} catch (e) {
  PayrollRun = null;
}


let PayrollRun;
try {
  PayrollRun = require('../models/PayrollRun');
} catch (e) {
  PayrollRun = null; // in case you don't have this model yet
}

const router = express.Router();

/* ---------- helpers ---------- */

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

  // For now, hard-code company info
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

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Paystub ${employeeFullName} - ${payDate}</title>
  <style>
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      margin: 0;
      padding: 24px;
      font-size: 11px;
      color: #000;
    }
    .page {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
        .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo img {
      height: 32px;
    }

    .row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    }
    .section {
      margin-bottom: 18px;
    }
    .brand {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 1px;
    }
    .sub-brand {
      font-size: 10px;
    }
    .check-meta {
      font-size: 11px;
      text-align: right;
    }
    .check-meta table {
      border-collapse: collapse;
    }
    .check-meta td {
      padding: 2px 4px;
    }
    .line {
      border-bottom: 1px solid #000;
      margin: 8px 0;
    }
    .label {
      font-weight: 600;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      padding: 3px 4px;
      border-bottom: 1px solid #ddd;
    }
    th {
      font-weight: 600;
      text-align: left;
      border-bottom: 1px solid #000;
    }
    .right {
      text-align: right;
    }
    .net-pay-line {
      margin-top: 10px;
      display: flex;
      justify-content: flex-end;
      font-size: 12px;
    }
    .net-pay-line span {
      margin-left: 6px;
    }
    .stub-block {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px dashed #aaa;
    }
    .small {
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Top check header -->
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
          <tr>
            <td class="label">Check Date</td>
            <td>${payDate}</td>
          </tr>
          <tr>
            <td class="label">Amount</td>
            <td>${netFormatted}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Payee lines -->
    <div class="section">
      <div><span class="label">Pay</span> ________________________________ Dollars</div>
      <div style="margin-top: 6px;">
        <span class="label">To The</span> ${employeeFullName || '&nbsp;'}
      </div>
      <div>
        <span class="label">Order Of:</span> ${employeeFullName || '&nbsp;'}
      </div>
      <div>${email || '&nbsp;'}</div>
    </div>

    <div class="line"></div>

    <!-- FIRST STUB -->
    <div class="section">
      <div class="label">${companyName}</div>
      <div>${employeeFullName}</div>
      <div>Employee ID: ${externalEmployeeId}</div>

      <div class="row" style="margin-top: 8px;">
        <!-- Earnings -->
        <div style="width: 55%; padding-right: 8px;">
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
        <div style="width: 45%; padding-left: 8px;">
          <table>
            <thead>
              <tr>
                <th>Deductions From Gross:</th>
                <th class="right">Current</th>
                <th class="right">YTD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gross</td>
                <td class="right">${formatCurrency(gross)}</td>
                <td class="right">${formatCurrency(ytdGross)}</td>
              </tr>
              <tr>
                <td>Federal Income Tax</td>
                <td class="right">(${formatCurrency(fed)})</td>
                <td class="right">(${formatCurrency(ytdFed)})</td>
              </tr>
              <tr>
                <td>Social Security (Employee)</td>
                <td class="right">(${formatCurrency(ss)})</td>
                <td class="right">(${formatCurrency(ytdSs)})</td>
              </tr>
              <tr>
                <td>Medicare (Employee)</td>
                <td class="right">(${formatCurrency(med)})</td>
                <td class="right">(${formatCurrency(ytdMed)})</td>
              </tr>
              <tr>
                <td>State Income Tax</td>
                <td class="right">(${formatCurrency(state)})</td>
                <td class="right">(${formatCurrency(ytdState)})</td>
              </tr>
              <tr>
                <td><strong>Total Taxes</strong></td>
                <td class="right"><strong>(${formatCurrency(totalTaxes)})</strong></td>
                <td class="right"><strong>(${formatCurrency(ytdTotalTaxes)})</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="net-pay-line">
        <span class="label">Net Pay:</span>
        <span>${netFormatted}</span>
      </div>

      <div class="small" style="margin-top: 6px;">
        Check Date: ${payDate}
        ${periodBegin && periodEnd ? `&nbsp;&nbsp; Pay Period: ${periodBegin} - ${periodEnd}` : ''}
      </div>
    </div>

    <!-- SECOND STUB COPY -->
    <div class="stub-block">
      <div class="label">${companyName}</div>
      <div>${employeeFullName}</div>
      <div>Employee ID: ${externalEmployeeId}</div>

      <div class="row" style="margin-top: 8px;">
        <div style="width: 55%; padding-right: 8px;">
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

        <div style="width: 45%; padding-left: 8px;">
          <table>
            <thead>
              <tr>
                <th>Deductions From Gross:</th>
                <th class="right">Current</th>
                <th class="right">YTD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gross</td>
                <td class="right">${formatCurrency(gross)}</td>
                <td class="right">${formatCurrency(ytdGross)}</td>
              </tr>
              <tr>
                <td>Federal Income Tax</td>
                <td class="right">(${formatCurrency(fed)})</td>
                <td class="right">(${formatCurrency(ytdFed)})</td>
              </tr>
              <tr>
                <td>Social Security (Employee)</td>
                <td class="right">(${formatCurrency(ss)})</td>
                <td class="right">(${formatCurrency(ytdSs)})</td>
              </tr>
              <tr>
                <td>Medicare (Employee)</td>
                <td class="right">(${formatCurrency(med)})</td>
                <td class="right">(${formatCurrency(ytdMed)})</td>
              </tr>
              <tr>
                <td>State Income Tax</td>
                <td class="right">(${formatCurrency(state)})</td>
                <td class="right">(${formatCurrency(ytdState)})</td>
              </tr>
              <tr>
                <td><strong>Total Taxes</strong></td>
                <td class="right"><strong>(${formatCurrency(totalTaxes)})</strong></td>
                <td class="right"><strong>(${formatCurrency(ytdTotalTaxes)})</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="net-pay-line">
        <span class="label">Net Pay:</span>
        <span>${netFormatted}</span>
      </div>

      <div class="section" style="margin-top: 12px;">
        <div class="label">${companyName}</div>
        <div>${companyAddressLine1}</div>
        <div>${companyAddressLine2}</div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

/* ---------- ROUTES ---------- */

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

// Employee: list paystubs by employee (Mongo _id OR externalEmployeeId)
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    const query = {};
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      query._id = employeeId;
    } else {
      query.externalEmployeeId = employeeId;
    }

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
    res.status(500).json({
      message: 'Server error fetching employee paystubs',
    });
  }
});

// HTML preview for a single stub
router.get('/:id/html', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) {
      return res.status(404).send('Paystub not found');
    }

    let payrollRunDoc = null;
    if (PayrollRun && stub.payrollRun) {
      payrollRunDoc = await PayrollRun.findById(stub.payrollRun);
    }

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

// PDF download for a single stub
router.get('/:id/pdf', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) {
      return res.status(404).send('Paystub not found');
    }

    let payrollRunDoc = null;
    if (PayrollRun && stub.payrollRun) {
      payrollRunDoc = await PayrollRun.findById(stub.payrollRun);
    }

    const html = buildPaystubHtml({
      stub,
      employee: stub.employee,
      payrollRun: payrollRunDoc,
    });

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
    });

    await browser.close();

    const employeeId =
      (stub.employee && stub.employee.externalEmployeeId) || 'employee';
    const payDate = stub.payDate
      ? new Date(stub.payDate).toISOString().slice(0, 10)
      : 'date';

    const fileName =
      stub.fileName || `nwf_${employeeId}_${payDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating paystub PDF:', err);
    res.status(500).send('Error generating paystub PDF');
  }
});

// Single paystub JSON
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
