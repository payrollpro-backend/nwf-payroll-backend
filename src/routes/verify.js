// src/routes/verify.js
const express = require('express');
const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');

const router = express.Router();

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

router.get('/:code', async (req, res) => {
  try {
    const rawCode = req.params.code || '';
    const code = rawCode.trim().toUpperCase();

    if (!code) {
      return res.status(400).send('<h1>Invalid verification code</h1>');
    }

    const stub = await Paystub.findOne({ verificationCode: code })
      .populate('employee', 'firstName lastName externalEmployeeId email');

    const isFound = !!stub;

    let html = '';

    if (!isFound) {
      // Not found page
      html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NWF Paystub Verification • Code Not Found</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f3f4f6;
      color: #111827;
    }
    .page {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 15px 40px rgba(15, 23, 42, 0.12);
      padding: 28px 24px 24px;
      text-align: center;
    }
    .logo {
      margin-bottom: 16px;
    }
    .logo img {
      height: 40px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #fef2f2;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    h1 {
      margin: 16px 0 8px;
      font-size: 22px;
      font-weight: 700;
      color: #111827;
    }
    p {
      margin: 4px 0;
      color: #4b5563;
      font-size: 14px;
    }
    .code {
      margin-top: 12px;
      font-family: "SF Mono", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 15px;
      padding: 6px 12px;
      display: inline-block;
      border-radius: 999px;
      background: #f9fafb;
      border: 1px dashed #e5e7eb;
      color: #111827;
    }
    .footer {
      margin-top: 18px;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="logo">
        <img src="https://cdn.shopify.com/s/files/1/0970/4882/2041/files/NWF_BRANDED_LOGO.png?v=1764317298" alt="NWF Payroll Services" />
      </div>
      <div class="badge">Verification Failed</div>
      <h1>Paystub Not Found</h1>
      <p>We were unable to locate a paystub for the verification code below.</p>
      <p>Please confirm the code was entered exactly as it appears on the document.</p>
      <div class="code">Code: ${code}</div>
      <div class="footer">
        NWF PAYROLL SERVICES • Independent verification powered by NWF.
      </div>
    </div>
  </div>
</body>
</html>`;
    } else {
      const employee = stub.employee || {};
      const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
      const employeeId = employee.externalEmployeeId || '';
      const email = employee.email || '';
      const payDateStr = formatDate(stub.payDate);
      const netPayStr = formatCurrency(stub.netPay || 0);
      const createdAtStr = formatDate(stub.createdAt);

      html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NWF Paystub Verification • Verified</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f3f4f6;
      color: #111827;
    }
    .page {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }
    .card {
      max-width: 640px;
      width: 100%;
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.14);
      padding: 28px 24px 24px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo img {
      height: 40px;
    }
    .brand-text {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6b7280;
      font-weight: 600;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34,197,94,0.25);
    }
    h1 {
      margin: 0 0 4px;
      font-size: 22px;
      font-weight: 700;
      color: #111827;
    }
    .sub {
      margin: 0;
      font-size: 13px;
      color: #6b7280;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 18px;
    }
    .panel {
      padding: 12px 14px;
      border-radius: 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
    }
    .panel-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #9ca3af;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .panel-line {
      font-size: 13px;
      color: #111827;
      margin: 2px 0;
    }
    .panel-line span.label {
      color: #6b7280;
    }
    .highlight {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
    }
    .highlight-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6b7280;
    }
    .code-box {
      margin-top: 18px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f9fafb;
      border: 1px dashed #d1d5db;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .code {
      font-family: "SF Mono", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 15px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #111827;
      color: #f9fafb;
    }
    .code-label {
      font-size: 11px;
      color: #6b7280;
    }
    .footer {
      margin-top: 18px;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      font-size: 11px;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="card-header">
        <div class="logo">
          <img src="https://cdn.shopify.com/s/files/1/0970/4882/2041/files/NWF_BRANDED_LOGO.png?v=1764317298" alt="NWF Payroll Services" />
          <div class="brand-text">Paystub Verification</div>
        </div>
        <div class="badge">
          <span class="badge-dot"></span>
          Verified by NWF
        </div>
      </div>

      <h1>Paystub Verified</h1>
      <p class="sub">This paystub has been validated against records on file with NWF Payroll Services.</p>

      <div class="grid">
        <div class="panel">
          <div class="panel-title">Employee</div>
          <div class="panel-line"><strong>${employeeName}</strong></div>
          <div class="panel-line"><span class="label">Employee ID:</span> ${employeeId || '—'}</div>
          <div class="panel-line"><span class="label">Email:</span> ${email || '—'}</div>
        </div>

        <div class="panel">
          <div class="panel-title">Pay Details</div>
          <div class="panel-line"><span class="label">Pay Date:</span> ${payDateStr || '—'}</div>
          <div class="panel-line"><span class="label">Net Pay:</span> <strong>${netPayStr}</strong></div>
          <div class="panel-line"><span class="label">Generated:</span> ${createdAtStr || '—'}</div>
        </div>

        <div class="panel">
          <div class="panel-title">Employer</div>
          <div class="panel-line"><strong>NSE MANAGEMENT INC</strong></div>
          <div class="panel-line">Payroll administered by NWF Payroll Services.</div>
        </div>
      </div>

      <div class="code-box">
        <div>
          <div class="code-label">Verification Code</div>
          <div class="code">${code}</div>
        </div>
        <div>
          <div class="highlight-label">Net Pay for This Stub</div>
          <div class="highlight">${netPayStr}</div>
        </div>
      </div>

      <div class="footer">
        <div>NWF PAYROLL SERVICES • Independent third-party payroll verification.</div>
        <div>For questions, contact the employee or NWF Payroll administrator.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Verification error:', err);
    return res.status(500).send('<h1>Server error verifying paystub.</h1>');
  }
});

module.exports = router;
