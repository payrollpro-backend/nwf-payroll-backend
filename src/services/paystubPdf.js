const ejs = require("ejs");
const pdf = require("html-pdf");
const path = require("path");
const moment = require("moment");

/**
 * Generate ADP-style NWF paystub PDF using your CorelDRAW template.
 */
async function generateAdpPaystubPdf(paystub) {
  try {
    // -------------------------------
    // FORMAT DATES
    // -------------------------------
    const payDate = paystub.payDate ? moment(paystub.payDate) : null;
    const payPeriodBegin = paystub.payPeriodBegin
      ? moment(paystub.payPeriodBegin)
      : null;
    const payPeriodEnd = paystub.payPeriodEnd
      ? moment(paystub.payPeriodEnd)
      : null;

    const payDateFormatted = payDate ? payDate.format("MM/DD/YYYY") : "";
    const payPeriodBeginFormatted = payPeriodBegin
      ? payPeriodBegin.format("MM/DD/YYYY")
      : "";
    const payPeriodEndFormatted = payPeriodEnd
      ? payPeriodEnd.format("MM/DD/YYYY")
      : "";

    // -------------------------------
    // MASK EMPLOYEE ID (last 6 digits visible)
    // -------------------------------
    const fullEmployeeId = paystub.employee.externalEmployeeId || "";
    let maskedEmployeeId = "";
    if (fullEmployeeId.length >= 6) {
      maskedEmployeeId =
        "XXXXXX" + fullEmployeeId.slice(fullEmployeeId.length - 6);
    }

    // -------------------------------
    // EMPLOYEE NAME PIECES
    // -------------------------------
    const employeeFirstName = paystub.employee.firstName || "";
    const employeeLastName = paystub.employee.lastName || "";
    const employeeFullName = `${employeeFirstName} ${employeeLastName}`.trim();

    // -------------------------------
    // EMPLOYEE ADDRESS (if stored)
    // -------------------------------
    const employeeAddress = paystub.employee.address || {};
    const employeeAddressLine1 = employeeAddress.line1 || "";
    const employeeAddressLine2 = employeeAddress.line2 || "";
    const employeeCity = employeeAddress.city || "";
    const employeeState = employeeAddress.state || "";
    const employeeZip = employeeAddress.zip || "";

    // -------------------------------
    // NUMBERS FOR THE STUB
    // -------------------------------
    const grossPay = paystub.grossPay || 0;
    const netPay = paystub.netPay || 0;

    const federalIncomeTax = paystub.federalIncomeTax || 0;
    const stateIncomeTax = paystub.stateIncomeTax || 0;
    const socialSecurity = paystub.socialSecurity || 0;
    const medicare = paystub.medicare || 0;

    const ytdGross = paystub.ytdGross || 0;
    const ytdNet = paystub.ytdNet || 0;
    const ytdFederalIncomeTax = paystub.ytdFederalIncomeTax || 0;
    const ytdStateIncomeTax = paystub.ytdStateIncomeTax || 0;
    const ytdSocialSecurity = paystub.ytdSocialSecurity || 0;
    const ytdMedicare = paystub.ytdMedicare || 0;

    const regularHoursFormatted = (paystub.regularHours || 0).toFixed(2);
    const regularRateFormatted = (paystub.regularRate || 0).toFixed(2);

    // -------------------------------
    // YOUR NEW 8.5x11 BACKGROUND IMAGE FROM COREL
    // -------------------------------
    const backgroundUrl = "https://www.nwfpayroll.com/nwf-paystub-bg.png";

    // -------------------------------
    // TEMPLATE HTML (THE ONE WE BUILT TO MATCH COREL)
    // -------------------------------
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
      font-size: 12px;
    }

    /* ===== TOP HEADER: LEFT COMPANY + RIGHT PAY INFO ===== */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-left {
      font-size: 12px;
      line-height: 1.4;
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
      margin-top: 70px;
    }

    .header-right .label {
      font-weight: 700;
    }

    /* ===== STUB: TOP HALF ===== */
    .top-stub {
      margin-top: 55px;
    }

    .stub-main-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .employee-block-left {
      font-size: 12px;
      line-height: 1.4;
    }

    .employee-block-left .emp-label {
      font-weight: 700;
      margin-bottom: 4px;
    }

    .employee-block-left .emp-line,
    .employee-block-left .emp-id {
      font-size: 12px;
    }

    .employee-block-right {
      text-align: right;
      font-size: 16px;
      line-height: 1.3;
    }

    .employee-block-right .emp-name-big {
      font-weight: 700;
      margin-bottom: 4px;
    }

    .tables-row-top {
      margin-top: 30px;
      display: flex;
      gap: 40px;
    }

    .tables-row-bottom {
      margin-top: 120px;
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
      margin-top: 8px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      justify-content: flex-end;
      gap: 30px;
      align-items: baseline;
    }

  </style>
</head>
<body>
  <div class="page">
    <img src="<%= backgroundUrl %>" class="page-bg" />

    <div class="page-content">

      <!-- ===== TOP HEADER ROW ===== -->
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

      <!-- ===== TOP STUB BLOCK ===== -->
      <div class="top-stub">

        <div class="stub-main-row">

          <div class="employee-block-left">
            <div class="emp-label">EMPLOYEE NAME</div>
            <div class="emp-line"><%= employeeLastName %>, <%= employeeFirstName %> (Employee)</div>
            <div class="emp-id">Employee ID: <%= maskedEmployeeId %></div>
          </div>

          <div class="employee-block-right">
            <div class="emp-name-big"><%= employeeLastName %>, <%= employeeFirstName %></div>
            <% if (employeeAddressLine1) { %>
              <div><%= employeeAddressLine1 %></div>
            <% } %>
            <% if (employeeAddressLine2) { %>
              <div><%= employeeAddressLine2 %></div>
            <% } %>
            <% if (employeeCity || employeeState || employeeZip) { %>
              <div>
                <%= employeeCity %> <%= employeeState %> <%= employeeZip %>
              </div>
            <% } %>
          </div>

        </div>

        <div class="tables-row-top">

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
          <div>Net Pay:</div>
          <div>$<%= netPay.toFixed(2) %></div>
          <div><%= ytdNet.toFixed(2) %></div>
        </div>

      </div>

      <!-- ===== BOTTOM STUB BLOCK ===== -->
      <div class="tables-row-bottom">

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
        <div>Net Pay:</div>
        <div>$<%= netPay.toFixed(2) %></div>
        <div><%= ytdNet.toFixed(2) %></div>
      </div>

    </div>
  </div>
</body>
</html>
`;

    // -------------------------------
    // RENDER HTML USING EJS
    // -------------------------------
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

    // -------------------------------
    // GENERATE PDF
    // -------------------------------
    const pdfOptions = {
      format: "Letter",
      border: "5mm",
      timeout: 30000,
      phantomArgs: ["--ignore-ssl-errors=yes", "--ssl-protocol=any"],
    };

    return new Promise((resolve, reject) => {
      pdf.create(html, pdfOptions).toBuffer((err, buffer) => {
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
