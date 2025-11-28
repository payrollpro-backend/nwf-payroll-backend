// utils/paystubTemplate.js

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

/**
 * Build HTML string for a single paystub.
 * @param {Object} params.stub - Paystub document
 * @param {Object} params.employee - Populated Employee
 * @param {Object} params.payrollRun - Populated PayrollRun (optional)
 */
function buildPaystubHtml({ stub, employee, payrollRun }) {
  const firstName = (employee && employee.firstName) || stub.firstName || '';
  const lastName = (employee && employee.lastName) || stub.lastName || '';
  const email = (employee && employee.email) || stub.email || '';
  const externalEmployeeId =
    (employee && employee.externalEmployeeId) ||
    stub.externalEmployeeId ||
    '';

  const employeeFullName = `${firstName} ${lastName}`.trim();

  const payDate = formatDate(stub.payDate);
  const periodBegin = payrollRun ? formatDate(payrollRun.periodStart) : '';
  const periodEnd = payrollRun ? formatDate(payrollRun.periodEnd) : '';

  // For now, hard-code; later you can pull from Employer/company settings
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
      <div>
        <div class="brand">NWF PAYROLL SERVICES</div>
        <div class="sub-brand">PAYROLL SERVICES</div>
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

    <!-- Payee line -->
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

    <!-- First stub -->
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

    <!-- Second stub copy -->
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
</html>
  `;
}

module.exports = { buildPaystubHtml };
