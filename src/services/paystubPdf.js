// src/services/paystubPdf.js

const ejs = require("ejs");
const pdf = require("html-pdf");

/**
 * Full-page paystub layout approximating your CorelDRAW design
 * with left/right blocks and repeated stub.
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
      padding: 40px 60px 40px 60px;
      font-size: 11px;
    }

    /* ===== TOP HEADER: COMPANY LEFT, PAY INFO RIGHT ===== */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-left {
      font-size: 12px;
      line-height: 1.4;
      margin-top: 10px;
    }

    .header-left .company-name {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 3px;
    }

    .header-left .company-line {
      font-size: 12px;
    }

    .header-right {
      text-align: right;
      font-size: 12px;
      line-height: 1.5;
      margin-top: 70px; /* roughly matches your "press return 13 times" */
    }

    .header-right .label {
      font-weight: 700;
    }

    /* ===== EMPLOYEE BLOCK ROW (TOP STUB) ===== */
    .top-employee-row {
      margin-top: 70px; /* roughly your "press return 7 + space" for left block 2 */
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .employee-left {
      font-size: 12px;
      line-height: 1.4;
    }

    .employee-left .emp-label {
      font-weight: 700;
      margin-bottom: 4px;
    }

    .employee-left .emp-line {
      font-size: 12px;
    }

    .employee-left .emp-id {
      font-size: 12px;
      margin-top: 4px;
    }

    .employee-right {
      text-align: right;
      font-size: 14px;
      line-height: 1.3;
    }

    .employee-right .emp-name-big {
      font-weight: 700;
      font-size: 16px;
      margin-bottom: 4px;
    }

    .employee-right .emp-address-line {
      font-size: 13px;
    }

    /* ===== TABLE ROW AREA (TOP STUB) ===== */
    .tables-row-top {
      margin-top: 30px;
      display: flex;
      gap: 40px;
    }

    .col-half {
      flex: 1;
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

    .table-header-line {
      height: 1px;
      background-color: #000;
      margin-bottom: 4px;
      opacity: 0.7;
    }

    .deductions-title {
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .netpay-row {
      margin-top: 12px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      justify-content: flex-end;
      gap: 30px;
      align-items: baseline;
    }

    .netpay-row-label {
      min-width: 60px;
      text-align: right;
    }

    /* ===== BOTTOM STUB (repeat of top) ===== */
    .bottom-stub-separator {
      margin-top: 70px; /* space between upper & lower stub */
      border-top: 1px dashed #9ca3af;
      padding-top: 20px;
    }

    .bottom-employee-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 10px;
    }

    .tables-row-bottom {
      margin-top: 25px;
      display: flex;
      gap: 40px;
    }
  </style>
</head>
<body>
  <div class="page">
    <img src="<%= backgroundUrl %>" class="page-bg" />

    <div class="page-content">

      <!-- ===== TOP HEADER: COMPANY (LEFT) + PAY INFO (RIGHT) ===== -->
      <div class="header-row">
        <div class="header-left">
          <div class="company-name">NSE MANAGEMENT INC</div>
          <div class="company-line">4711 Nutmeg Way SW</div>
          <div class="company-line">Lilburn GA 30047</div>
        </div>

        <div class="header-right">
          <div><span class="label">Check Date:</span> <%= payDateFormatted %></div>
          <div><span class="label">Pay Period Beginning:</span> <%= payPeriodBeginFormatted %></div>
          <div><span class="label">Pay Period Ending:</span> <%= payPeriodEndFormatted %></div>
        </div>
      </div>

      <!-- ===== TOP EMPLOYEE BLOCK ===== -->
      <div class="top-employee-row">

        <!-- Left side: EMPLOYEE NAME / ID label as you described -->
        <div class="employee-left">
          <div class="emp-label">EMPLOYEE NAME</div>
          <div class="emp-line"><%= employeeLastName %>, <%= employeeFirstName %> (Employee)</div>
          <div class="emp-id">Employee ID: <%= maskedEmployeeId %></div>
        </div>

        <!-- Right side: Bigger name + address, lined up with your right block -->
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

      <!-- ===== TOP STUB TABLES: EARNINGS + DEDUCTIONS ===== -->
      <div class="tables-row-top">

        <!-- LEFT: Earnings table -->
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
          <div class="table-header-line"></div>
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

        <!-- RIGHT: Deductions table -->
        <div class="col-half">
          <div class="deductions-title">DEDUCTIONS</div>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Current</th>
                <th>YTD</th>
              </tr>
            </thead>
          </table>
          <div class="table-header-line"></div>
          <table>
            <tbody>
              <tr>
                <td>Federal Income Tax</td>
                <td>($<%= federalIncomeTax.toFixed(2) %>)</td>
                <td>($<%= ytdFederalIncomeTax.toFixed(2) %>)</td>
              </tr>
              <tr>
                <td>Social Security</td>
                <td>($<%= socialSecurity.toFixed(2) %>)</td>
                <td>($<%= ytdSocialSecurity.toFixed(2) %>)</td>
              </tr>
              <tr>
                <td>Medicare</td>
                <td>($<%= medicare.toFixed(2) %>)</td>
                <td>($<%= ytdMedicare.toFixed(2) %>)</td>
              </tr>
              <tr>
                <td>State Income Tax</td>
                <td>($<%= stateIncomeTax.toFixed(2) %>)</td>
                <td>($<%= ytdStateIncomeTax.toFixed(2) %>)</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- NET PAY (top stub) -->
      <div class="netpay-row">
        <div class="netpay-row-label">Net Pay:</div>
        <div>$<%= netPay.toFixed(2) %></div>
        <div>YTD: $<%= ytdNet.toFixed(2) %></div>
      </div>

      <!-- ===== BOTTOM STUB (DUPLICATE) ===== -->
      <div class="bottom-stub-separator">

        <!-- Repeat employee row to line up with background bottom stub -->
        <div class="bottom-employee-row">
          <div class="employee-left">
            <div class="emp-label">EMPLOYEE NAME</div>
            <div class="emp-line"><%= employeeLastName %>, <%= employeeFirstName %> (Employee)</div>
            <div class="emp-id">Employee ID: <%= maskedEmployeeId %></div>
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

          <!-- BOTTOM Earnings -->
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
            <div class="table-header-line"></div>
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

          <!-- BOTTOM Deductions -->
          <div class="col-half">
            <div class="deductions-title">DEDUCTIONS</div>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
            </table>
            <div class="table-header-line"></div>
            <table>
              <tbody>
                <tr>
                  <td>Federal Income Tax</td>
                  <td>($<%= federalIncomeTax.toFixed(2) %>)</td>
                  <td>($<%= ytdFederalIncomeTax.toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Social Security</td>
                  <td>($<%= socialSecurity.toFixed(2) %>)</td>
                  <td>($<%= ytdSocialSecurity.toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Medicare</td>
                  <td>($<%= medicare.toFixed(2) %>)</td>
                  <td>($<%= ytdMedicare.toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>State Income Tax</td>
                  <td>($<%= stateIncomeTax.toFixed(2) %>)</td>
                  <td>($<%= ytdStateIncomeTax.toFixed(2) %>)</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <div class="netpay-row">
          <div class="netpay-row-label">Net Pay:</div>
          <div>$<%= netPay.toFixed(2) %></div>
          <div>YTD: $<%= ytdNet.toFixed(2) %></div>
        </div>

      </div>

    </div>
  </div>
</body>
</html>
`;

/**
 * Generate paystub PDF with CorelDRAW-style layout.
 */
async function generateAdpPaystubPdf(paystub) {
  try {
    // ---- Dates ----
    const payDate = paystub.payDate ? new Date(paystub.payDate) : new Date();

    // Try multiple field names for period begin/end in case your model differs
    const periodBeginRaw =
      paystub.payPeriodBegin ||
      paystub.periodStart ||
      paystub.periodBegin ||
      null;
    const periodEndRaw =
      paystub.payPeriodEnd ||
      paystub.periodEnd ||
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
    const employeeFirstName = paystub.employee?.firstName || "";
    const employeeLastName = paystub.employee?.lastName || "";
    const employeeFullName = `${employeeFirstName} ${employeeLastName}`.trim();

    const fullEmployeeId = paystub.employee?.externalEmployeeId || "";
    const maskedEmployeeId =
      fullEmployeeId && fullEmployeeId.length >= 6
        ? "XXXXXX" + fullEmployeeId.slice(-6)
        : fullEmployeeId || "";

    const address = paystub.employee?.address || {};
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

    // ---- Background image ----
    const backgroundUrl = "https://www.nwfpayroll.com/nwf-paystub-bg.png";

    // ---- Render HTML with EJS ----
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
      ytdMedicare
    });

    // ---- Create PDF buffer ----
    return await new Promise((resolve, reject) => {
      pdf.create(html, {
        format: "Letter",
        border: "5mm",
        timeout: 30000,
        phantomArgs: ["--ignore-ssl-errors=yes", "--ssl-protocol=any"],
      }).toBuffer((err, buffer) => {
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
  generateAdpPaystubPdf,
};
