// src/services/paystubPdf.js

const ejs = require("ejs");
const pdf = require("html-pdf");

/**
 * Helper to format currency with parentheses for negatives.
 * e.g. -927.92 => "(927.92)"  |  927.92 => "927.92"
 */
function formatCurrency(value) {
  const v = Number(value || 0);
  const abs = Math.abs(v).toFixed(2);
  return v < 0 ? "(" + abs + ")" : abs;
}

/**
 * Corel-style, double-stub paystub layout with your NWF background.
 * The background already includes the top-right NWF logo + green band.
 */
const PAYSTUB_TEMPLATE_V2 = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Paystub - <%= employeeFullName %></title>
  <style>
    * {
      box-sizing: border-box;
      font-family: Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
      min-height: 1056px; /* ~11in at 96dpi */
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
      font-size: 11px;
    }

    /* ===== TOP COMPANY HEADER LEFT / PAY INFO RIGHT ===== */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-left {
      font-size: 12px;
      line-height: 1.4;
      margin-top: 4px;
    }

    .header-left .company-name {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .header-left .company-line {
      font-size: 12px;
    }

    .header-right {
      text-align: right;
      font-size: 12px;
      line-height: 1.5;
      margin-top: 70px; /* ~ your "13 returns" */
    }

    .header-right .label {
      font-weight: 700;
    }

    /* ===== EMPLOYEE ROW (TOP STUB) ===== */
    .top-employee-row {
      margin-top: 80px; /* matches space before EMPLOYEE block on left */
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .employee-left {
      font-size: 12px;
      line-height: 1.4;
    }

    .employee-left .emp-section-label {
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: 1px;
    }

    .employee-left .emp-name-line {
      font-weight: 700;
      margin-bottom: 2px;
    }

    .employee-left .emp-id {
      margin-top: 2px;
    }

    .employee-right {
      text-align: right;
      font-size: 14px;
      line-height: 1.3;
      max-width: 260px;
    }

    .employee-right .emp-name-big {
      font-weight: 700;
      font-size: 16px;
      margin-bottom: 4px;
    }

    .employee-right .emp-address-line {
      font-size: 13px;
    }

    /* ===== TABLES ROW (TOP STUB) ===== */
    .tables-row-top {
      margin-top: 40px;
      display: flex;
      gap: 40px;
    }

    .col-half {
      flex: 1;
    }

    .table-title {
      font-weight: 700;
      margin-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
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
      font-size: 11px;
      font-weight: 700;
    }

    .header-underline {
      height: 1px;
      background-color: #000;
      margin-bottom: 4px;
      opacity: 0.7;
    }

    .netpay-row {
      margin-top: 14px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      justify-content: flex-end;
      gap: 30px;
      align-items: baseline;
    }

    .netpay-row-label {
      min-width: 70px;
      text-align: right;
    }

    /* ===== BOTTOM STUB (REPEAT) ===== */
    .bottom-stub-separator {
      margin-top: 80px; /* space between top & bottom stubs */
      border-top: 0px solid transparent;
      padding-top: 10px;
      position: relative;
    }

    .bottom-employee-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 20px;
    }

    .tables-row-bottom {
      margin-top: 25px;
      display: flex;
      gap: 40px;
    }

    /* Vertical verification text on left bottom */
    .verification-strip {
      position: absolute;
      left: -40px;
      top: 120px;
      font-size: 9px;
      transform-origin: left top;
      transform: rotate(-90deg);
      color: #555;
    }

    .verification-strip a {
      color: #555;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="page">
    <img src="<%= backgroundUrl %>" class="page-bg" />

    <div class="page-content">

      <!-- ===== TOP COMPANY + PAY DATES ===== -->
      <div class="header-row">
        <div class="header-left">
          <div class="company-name">NSE MANAGEMENT INC</div>
          <div class="company-line">4711 Nutmeg Way SW</div>
          <div class="company-line">Lilburn&nbsp;&nbsp;&nbsp;GA&nbsp;&nbsp;&nbsp;30047</div>
        </div>

        <div class="header-right">
          <div><span class="label">Check Date:</span> <%= payDateFormatted %></div>
          <div><span class="label">Pay Period Beginning:</span> <%= payPeriodBeginFormatted %></div>
          <div><span class="label">Pay Period Ending:</span> <%= payPeriodEndFormatted %></div>
        </div>
      </div>

      <!-- ===== TOP EMPLOYEE ROW ===== -->
      <div class="top-employee-row">
        <div class="employee-left">
          <div class="emp-section-label">EMPLOYEE</div>
          <div class="emp-name-line"><%= employeeLastName %>, <%= employeeFirstName %></div>
          <div>Employee ID:<%= " " + maskedEmployeeId %></div>
        </div>

        <div class="employee-right">
          <div class="emp-name-big"><%= employeeLastName %>, <%= employeeFirstName %></div>
          <% if (employeeAddressLine1) { %>
            <div class="emp-address-line"><%= employeeAddressLine1 %></div>
          <% } %>
          <% if (employeeAddressLine2) { %>
            <div class="emp-address-line"><%= employeeAddressLine2 %></div>
          <% } %>
          <% if (employeeCity || employeeState || employeeZip) { %>
            <div class="emp-address-line">
              <%= employeeCity %> <%= employeeState %> <%= employeeZip %>
            </div>
          <% } %>
        </div>
      </div>

      <!-- ===== TOP TABLES ===== -->
      <div class="tables-row-top">

        <!-- LEFT: Earnings -->
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
          </table>
          <div class="header-underline"></div>
          <table>
            <tbody>
              <tr>
                <td>Regular</td>
                <td><%= regularHoursFormatted %></td>
                <td><%= regularRateFormatted %></td>
                <td>$<%= grossPay.toFixed(2) %></td>
                <td>$<%= ytdGross.toFixed(2) %></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- RIGHT: Deductions -->
        <div class="col-half">
          <div class="table-title">Deductions From Gross:</div>
          <table>
            <thead>
              <tr>
                <th> </th>
                <th>Current</th>
                <th>YTD</th>
              </tr>
            </thead>
          </table>
          <div class="header-underline"></div>
          <table>
            <tbody>
              <tr>
                <td>Gross</td>
                <td>$<%= grossPay.toFixed(2) %></td>
                <td>$<%= ytdGross.toFixed(2) %></td>
              </tr>
              <tr>
                <td>Federal Income Tax</td>
                <td>(<%= formatCurrency(federalIncomeTax) %>)</td>
                <td>(<%= formatCurrency(ytdFederalIncomeTax) %>)</td>
              </tr>
              <tr>
                <td>Social Security (Employee)</td>
                <td>(<%= formatCurrency(socialSecurity) %>)</td>
                <td>(<%= formatCurrency(ytdSocialSecurity) %>)</td>
              </tr>
              <tr>
                <td>Medicare (Employee)</td>
                <td>(<%= formatCurrency(medicare) %>)</td>
                <td>(<%= formatCurrency(ytdMedicare) %>)</td>
              </tr>
              <tr>
                <td>State of GA Income Tax</td>
                <td>(<%= formatCurrency(stateIncomeTax) %>)</td>
                <td>(<%= formatCurrency(ytdStateIncomeTax) %>)</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- NET PAY (TOP) -->
      <div class="netpay-row">
        <div class="netpay-row-label">Net Pay:</div>
        <div>$&nbsp;<%= netPay.toFixed(2) %></div>
        <div><%= ytdNet.toFixed(2) %></div>
      </div>

      <!-- ===== BOTTOM STUB ===== -->
      <div class="bottom-stub-separator">

        <!-- Vertical verification strip -->
        <div class="verification-strip">
          Verification Code: <%= verificationCode %> &nbsp;|&nbsp;
          Verify online at:
          <a href="<%= verificationUrl %>"><%= verificationUrl %></a>
        </div>

        <div class="bottom-employee-row">
          <div class="employee-left">
            <div class="emp-section-label">EMPLOYEE</div>
            <div class="emp-name-line"><%= employeeLastName %>, <%= employeeFirstName %></div>
            <div>Employee ID:<%= " " + maskedEmployeeId %></div>
          </div>

          <div class="employee-right">
            <div class="emp-name-big"><%= employeeLastName %>, <%= employeeFirstName %></div>
            <% if (employeeAddressLine1) { %>
              <div class="emp-address-line"><%= employeeAddressLine1 %></div>
            <% } %>
            <% if (employeeAddressLine2) { %>
              <div class="emp-address-line"><%= employeeAddressLine2 %></div>
            <% } %>
            <% if (employeeCity || employeeState || employeeZip) { %>
              <div class="emp-address-line">
                <%= employeeCity %> <%= employeeState %> <%= employeeZip %>
              </div>
            <% } %>
          </div>
        </div>

        <div class="tables-row-bottom">

          <!-- Bottom Earnings -->
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
            </table>
            <div class="header-underline"></div>
            <table>
              <tbody>
                <tr>
                  <td>Regular</td>
                  <td><%= regularHoursFormatted %></td>
                  <td><%= regularRateFormatted %></td>
                  <td>$<%= grossPay.toFixed(2) %></td>
                  <td>$<%= ytdGross.toFixed(2) %></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Bottom Deductions -->
          <div class="col-half">
            <div class="table-title">Deductions From Gross:</div>
            <table>
              <thead>
                <tr>
                  <th> </th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
            </table>
            <div class="header-underline"></div>
            <table>
              <tbody>
                <tr>
                  <td>Gross</td>
                  <td>$<%= grossPay.toFixed(2) %></td>
                  <td>$<%= ytdGross.toFixed(2) %></td>
                </tr>
                <tr>
                  <td>Federal Income Tax</td>
                  <td>(<%= formatCurrency(federalIncomeTax) %>)</td>
                  <td>(<%= formatCurrency(ytdFederalIncomeTax) %>)</td>
                </tr>
                <tr>
                  <td>Social Security (Employee)</td>
                  <td>(<%= formatCurrency(socialSecurity) %>)</td>
                  <td>(<%= formatCurrency(ytdSocialSecurity) %>)</td>
                </tr>
                <tr>
                  <td>Medicare (Employee)</td>
                  <td>(<%= formatCurrency(medicare) %>)</td>
                  <td>(<%= formatCurrency(ytdMedicare) %>)</td>
                </tr>
                <tr>
                  <td>State of GA Income Tax</td>
                  <td>(<%= formatCurrency(stateIncomeTax) %>)</td>
                  <td>(<%= formatCurrency(ytdStateIncomeTax) %>)</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <div class="netpay-row">
          <div class="netpay-row-label">Net Pay:</div>
          <div>$&nbsp;<%= netPay.toFixed(2) %></div>
          <div><%= ytdNet.toFixed(2) %></div>
        </div>

      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Generate paystub PDF with Corel-style NWF layout.
 */
async function generateAdpPaystubPdf(paystub) {
  try {
    // ---- Dates ----
    const payDate = paystub.payDate ? new Date(paystub.payDate) : new Date();

    const periodBeginRaw =
      paystub.payPeriodBegin ||
      paystub.periodStart ||
      (paystub.payrollRun && paystub.payrollRun.payPeriodBegin) ||
      null;

    const periodEndRaw =
      paystub.payPeriodEnd ||
      paystub.periodEnd ||
      (paystub.payrollRun && paystub.payrollRun.payPeriodEnd) ||
      null;

    const payPeriodBegin = periodBeginRaw ? new Date(periodBeginRaw) : null;
    const payPeriodEnd = periodEndRaw ? new Date(periodEndRaw) : null;

    const payDateFormatted = payDate.toLocaleDateString("en-US");
    const payPeriodBeginFormatted = payPeriodBegin
      ? payPeriodBegin.toLocaleDateString("en-US")
      : "";
    const payPeriodEndFormatted = payPeriodEnd
      ? payPeriodEnd.toLocaleDateString("en-US")
      : "";

    // ---- Employee info ----
    const employee = paystub.employee || {};
    const employeeFirstName = employee.firstName || "";
    const employeeLastName = employee.lastName || "";
    const employeeFullName = `${employeeFirstName} ${employeeLastName}`.trim();

    const fullEmployeeId = employee.externalEmployeeId || "";
    const maskedEmployeeId =
      fullEmployeeId && fullEmployeeId.length >= 6
        ? "xxxxxx" + fullEmployeeId.slice(-6)
        : fullEmployeeId || "";

    const address = employee.address || {};
    const employeeAddressLine1 = address.line1 || "";
    const employeeAddressLine2 = address.line2 || "";
    const employeeCity = address.city || "";
    const employeeState = address.state || "";
    const employeeZip = address.zip || "";

    // ---- Earnings / Taxes / YTD ----
    const grossPay = Number(paystub.grossPay || 0);
    const netPay = Number(paystub.netPay || 0);

    const federalIncomeTax = Number(paystub.federalIncomeTax || 0);
    const stateIncomeTax = Number(paystub.stateIncomeTax || 0);
    const socialSecurity = Number(paystub.socialSecurity || 0);
    const medicare = Number(paystub.medicare || 0);

    const ytdGross = Number(paystub.ytdGross || 0);
    const ytdNet = Number(paystub.ytdNet || 0);
    const ytdFederalIncomeTax = Number(paystub.ytdFederalIncomeTax || 0);
    const ytdStateIncomeTax = Number(paystub.ytdStateIncomeTax || 0);
    const ytdSocialSecurity = Number(paystub.ytdSocialSecurity || 0);
    const ytdMedicare = Number(paystub.ytdMedicare || 0);

    const regularHoursFormatted = (paystub.regularHours || 0).toFixed(2);
    const regularRateFormatted = (paystub.regularRate || 0).toFixed(2);

    // ---- Verification ----
    const verificationCode = paystub.verificationCode || "";
    const baseVerifyUrl =
      process.env.NWF_VERIFY_BASE_URL ||
      "https://nwf-payroll-backend.onrender.com/verify/paystub";
    const verificationUrl =
      verificationCode && paystub._id
        ? `${baseVerifyUrl}?id=${encodeURIComponent(
            paystub._id.toString()
          )}&code=${encodeURIComponent(verificationCode)}`
        : baseVerifyUrl;

    // ---- Background image URL (host this PNG on your domain) ----
    const backgroundUrl =
      "https://www.nwfpayroll.com/nwf-payroll-background.png";

    // ---- Render HTML ----
    const html = await ejs.render(PAYSTUB_TEMPLATE_V2, {
      backgroundUrl,
      employeeFullName,
      employeeFirstName,
      employeeLastName,
      employeeAddressLine1,
      employeeAddressLine2,
      employeeCity,
      employeeState,
      employeeZip,
      maskedEmployeeId,
      payDateFormatted,
      payPeriodBeginFormatted,
      payPeriodEndFormatted,
      regularHoursFormatted,
      regularRateFormatted,
      grossPay,
      netPay,
      federalIncomeTax,
      stateIncomeTax,
      socialSecurity,
      medicare,
      ytdGross,
      ytdNet,
      ytdFederalIncomeTax,
      ytdStateIncomeTax,
      ytdSocialSecurity,
      ytdMedicare,
      verificationCode,
      verificationUrl,
      formatCurrency
    });

    // ---- Create PDF buffer ----
    return await new Promise((resolve, reject) => {
      pdf
        .create(html, {
          format: "Letter",
          border: "5mm",
          timeout: 30000,
          phantomArgs: ["--ignore-ssl-errors=yes", "--ssl-protocol=any"]
        })
        .toBuffer((err, buffer) => {
          if (err) return reject(err);
          resolve(buffer);
        });
    });
  } catch (err) {
    console.error("Error in generateAdpPaystubPdf:", err);
    throw err;
  }
}

module.exports = {
  generateAdpPaystubPdf
};
