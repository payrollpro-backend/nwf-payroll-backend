// src/services/paystubPdf.js
const ejs = require('ejs');
const pdf = require('html-pdf');

/**
 * Inline EJS template for NWF Paystub V2 (double stub, no check).
 * Using inline template so we can't accidentally load the old file.
 */
const PAYSTUB_TEMPLATE_V2 = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Paystub - <%= employeeFullName %> (V2)</title>
  <style>
    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      margin: 0;
      padding: 0;
      font-size: 11px;
      color: #222;
    }

    .page {
      position: relative;
      width: 100%;
      min-height: 1056px; /* ~11 in at 96dpi */
      overflow: hidden;
    }

    .page-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }

    .page-content {
      position: relative;
      z-index: 1;
      padding: 60px 70px 50px 70px;
    }

    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }

    .company-block-main {
      font-size: 11px;
      line-height: 1.5;
    }

    .company-name-main {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .nwf-block {
      text-align: right;
      font-size: 10px;
      line-height: 1.4;
    }

    .nwf-title {
      font-weight: 700;
    }

    .nwf-subtitle {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .top-dates {
      margin-top: 8px;
      font-size: 10px;
    }

    .top-dates div {
      margin-bottom: 2px;
    }

    .top-stub {
      margin-bottom: 32px;
    }

    .stub-main-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .stub-company-label {
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .employee-id-block {
      font-size: 10px;
      line-height: 1.5;
    }

    .employee-id-block .emp-name {
      font-weight: 600;
    }

    .employee-id-block .emp-id {
      font-size: 10px;
    }

    .employee-address-block {
      font-size: 10px;
      text-align: right;
      line-height: 1.5;
    }

    .employee-address-name {
      font-weight: 600;
      font-size: 11px;
    }

    .tables-row {
      display: flex;
      gap: 24px;
      margin-bottom: 18px;
    }

    .col-half {
      flex: 1;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    th, td {
      padding: 3px 4px;
      border-bottom: 1px solid #e5e7eb;
      text-align: right;
      white-space: nowrap;
    }

    th:first-child,
    td:first-child {
      text-align: left;
    }

    th {
      font-size: 9px;
      text-transform: uppercase;
      color: #555;
    }

    tfoot td {
      font-weight: 700;
      border-top: 1px solid #d1d5db;
    }

    .netpay-row {
      margin-top: 10px;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      justify-content: flex-end;
      gap: 40px;
      align-items: baseline;
    }

    .netpay-row .label {
      font-weight: 700;
    }

    .netpay-row .amount {
      font-weight: 700;
    }

    .netpay-row .ytd {
      font-weight: 700;
    }

    .bottom-stub {
      margin-top: 44px;
    }

    .bottom-stub .tables-row {
      margin-bottom: 16px;
    }

    .bottom-stub .netpay-row {
      margin-top: 8px;
    }

    .debug-label {
      font-size: 9px;
      color: #b91c1c;
      font-weight: 700;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- BLANK BACKGROUND WITH BAND + LINES -->
    <img src="<%= backgroundUrl %>" class="page-bg" />

    <div class="page-content">
      <!-- DEBUG LABEL SO WE KNOW V2 IS LIVE -->
      <div class="debug-label">NWF PAYSTUB TEMPLATE V2</div>

      <!-- TOP HEADER -->
      <div class="top-header">
        <div class="company-block-main">
          <div class="company-name-main">NSE MANAGEMENT INC</div>
          <div>4711 Nutmeg Way SW</div>
          <div>Lilburn&nbsp;&nbsp;GA&nbsp;&nbsp;30047</div>
        </div>
        <div class="nwf-block">
          <div class="nwf-title">NWF PAYROLL SERVICES</div>
          <div class="nwf-subtitle">PAYROLL FOR SMALL BUSINESSES &amp; SELF- EMPLOYED</div>
          <div class="top-dates">
            <div>Check Date:&nbsp;&nbsp;<%= payDateFormatted %></div>
            <div>Pay Period Beginning:&nbsp;&nbsp;<%= payPeriodBeginFormatted || '' %></div>
            <div>Pay Period Ending:&nbsp;&nbsp;<%= payPeriodEndFormatted || '' %></div>
          </div>
        </div>
      </div>

      <!-- TOP STUB -->
      <div class="top-stub">
        <div class="stub-main-row">
          <div>
            <div class="stub-company-label">NSE MANAGEMENT INC</div>
            <div class="employee-id-block">
              <div class="emp-name"><%= employeeFullName %></div>
              <div class="emp-id">
                Employee ID:<%= maskedEmployeeId || '' %>
              </div>
            </div>
          </div>
          <div class="employee-address-block">
            <div class="employee-address-name"><%= employeeFullName %></div>
            <% if (employeeAddressLine1) { %>
              <div><%= employeeAddressLine1 %></div>
            <% } %>
            <% if (employeeAddressLine2) { %>
              <div><%= employeeAddressLine2 %></div>
            <% } %>
            <% if (employeeCity || employeeState || employeeZip) { %>
              <div>
                <%= employeeCity %><% if (employeeCity && (employeeState || employeeZip)) { %>, <% } %>
                <%= employeeState %>
                <%= employeeZip %>
              </div>
            <% } %>
          </div>
        </div>

        <div class="tables-row">
          <!-- Earnings -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Earnings</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Regular</td>
                  <td><%= regularHoursFormatted %></td>
                  <td><%= regularRateFormatted %></td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Deductions -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Deductions From Gross:</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gross</td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
                <tr>
                  <td>Federal Income Tax</td>
                  <td>($<%= (federalIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdFederalIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Social Security (Employee)</td>
                  <td>($<%= (socialSecurity || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdSocialSecurity || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Medicare (Employee)</td>
                  <td>($<%= (medicare || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdMedicare || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>State of GA Income Tax</td>
                  <td>($<%= (stateIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdStateIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="netpay-row">
          <div class="label">Net Pay:</div>
          <div class="amount">$&nbsp;<%= (netPay || 0).toFixed(2) %></div>
          <div class="ytd"><%= (ytdNet || 0).toFixed(2) %></div>
        </div>
      </div>

      <!-- BOTTOM STUB -->
      <div class="bottom-stub">
        <div class="tables-row">
          <!-- Earnings copy -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Earnings</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Regular</td>
                  <td><%= regularHoursFormatted %></td>
                  <td><%= regularRateFormatted %></td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Deductions copy -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Deductions From Gross:</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gross</td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
                <tr>
                  <td>Federal Income Tax</td>
                  <td>($<%= (federalIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdFederalIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Social Security (Employee)</td>
                  <td>($<%= (socialSecurity || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdSocialSecurity || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Medicare (Employee)</td>
                  <td>($<%= (medicare || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdMedicare || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>State of GA Income Tax</td>
                  <td>($<%= (stateIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdStateIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="netpay-row">
          <div class="label">Net Pay:</div>
          <div class="amount">$&nbsp;<%= (netPay || 0).toFixed(2) %></div>
          <div class="ytd"><%= (ytdNet || 0).toFixed(2) %></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Build NWF ADP-style paystub PDF from a Paystub mongoose document.
 * Returns: Promise<Buffer>
 */
async function generateAdpPaystubPdf(paystub) {
  if (!paystub || !paystub.employee) {
    throw new Error('Paystub or employee missing');
  }

  const employeeFullName = `${paystub.employee.firstName || ''} ${paystub.employee.lastName || ''}`.trim();

  // Helper to format dates safely
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US') : '');

  const payDateFormatted = fmtDate(paystub.payDate);
  const payPeriodBeginFormatted = fmtDate(paystub.payPeriodStart);
  const payPeriodEndFormatted = fmtDate(paystub.payPeriodEnd);

  // Employee address from schema (optional)
  const addr = paystub.employee.address || {};
  const employeeAddressLine1 = addr.line1 || '';
  const employeeAddressLine2 = addr.line2 || '';
  const employeeCity = addr.city || '';
  const employeeState = addr.state || '';
  const employeeZip = addr.zip || '';

  // Employee ID and masked ID for display (only last 6 visible)
  const externalIdRaw = (paystub.employee.externalEmployeeId || '').trim();
  let maskedEmployeeId = externalIdRaw;
  if (externalIdRaw && externalIdRaw.length >= 6) {
    const last6 = externalIdRaw.slice(-6);
    maskedEmployeeId = 'xxxxxx' + last6;
  }

  const templateData = {
    // identity
    employeeFullName,
    employeeEmail: (paystub.employee.email || '').trim(),

    externalEmployeeId: externalIdRaw, // full ID (for verification)
    maskedEmployeeId,                  // masked for stub display

    payDateFormatted,
    payPeriodBeginFormatted,
    payPeriodEndFormatted,

    checkNumber: paystub.checkNumber || '',
    bankName: paystub.bankName || '',
    bankAccountLast4: paystub.bankAccountLast4 || '',
    verificationCode: paystub.verificationCode || '',

    employeeAddressLine1,
    employeeAddressLine2,
    employeeCity,
    employeeState,
    employeeZip,

    // money fields – ensure they are numbers so toFixed() is safe
    grossPay: Number(paystub.grossPay || 0),
    netPay: Number(paystub.netPay || 0),

    federalIncomeTax: Number(paystub.federalIncomeTax || 0),
    stateIncomeTax: Number(paystub.stateIncomeTax || 0),
    socialSecurity: Number(paystub.socialSecurity || 0),
    medicare: Number(paystub.medicare || 0),
    totalTaxes: Number(paystub.totalTaxes || 0),

    ytdGross: Number(paystub.ytdGross || 0),
    ytdNet: Number(paystub.ytdNet || 0),
    ytdFederalIncomeTax: Number(paystub.ytdFederalIncomeTax || 0),
    ytdStateIncomeTax: Number(paystub.ytdStateIncomeTax || 0),
    ytdSocialSecurity: Number(paystub.ytdSocialSecurity || 0),
    ytdMedicare: Number(paystub.ytdMedicare || 0),
    ytdTotalTaxes: Number(paystub.ytdTotalTaxes || 0),

    // placeholder rate/hours for now
    regularRateFormatted: '0.00',
    regularHoursFormatted: '0.00',

    // blank background with green band + lines
    backgroundUrl: 'https://www.nwfpayroll.com/nwf-background.png'
  };

  // Render HTML from inline EJS template
  const html = ejs.render(PAYSTUB_TEMPLATE_V2, templateData);

  // Convert HTML → PDF
  return new Promise((resolve, reject) => {
    pdf.create(
      html,
      {
        format: 'Letter',
        border: '5mm',
        timeout: 30000,
        phantomArgs: ['--ignore-ssl-errors=yes', '--ssl-protocol=any']
      }
    ).toBuffer((err, buffer) => {
      if (err) return reject(err);
      resolve(buffer);
    });
  });
}

module.exports = {
  generateAdpPaystubPdf,
};
