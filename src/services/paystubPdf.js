const ejs = require("ejs");
const pdf = require("html-pdf");

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const BACKGROUND_IMAGE_URL = "https://www.nwfpayroll.com/nwf-bg.png"; 

/**
 * Helper to format currency with parentheses for negatives.
 * e.g. -927.92 => "(927.92)"
 */
function formatCurrency(value) {
  const v = Number(value || 0);
  const abs = Math.abs(v).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  return v < 0 ? "(" + abs + ")" : abs;
}

/**
 * NWF PDF Layout Template
 * Contains EJS placeholders (<%= %>) for dynamic data.
 */
const PAYSTUB_TEMPLATE_V2 = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paystub - <%= employeeFullName %></title>
  <style>
    /* RESET & BASE */
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 12px;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff; 
    }
    
    .page-sheet {
      position: relative; 
      width: 100%; 
      height: 100%;
      margin: 0 auto;
      overflow: hidden; 
    }

    /* BACKGROUND LAYER */
    .page-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1; /* Behind text */
      object-fit: cover; 
    }

    /* CONTENT LAYER */
    .page-content {
      position: relative;
      z-index: 2; /* On top of image */
      padding: 60px 70px 50px 70px; 
    }

    /* UTILITIES */
    .clear { clear: both; }
    .bold { font-weight: bold; }
    
    /* LAYOUT SECTIONS */
    .header-row {
      display: -webkit-flex;
      display: flex;
      -webkit-justify-content: space-between;
      justify-content: space-between;
      margin-bottom: 30px;
    }

    /* HEADER */
    .company-info {
      font-weight: bold;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .payroll-service-branding {
      text-align: right;
      font-weight: bold;
      color: #333;
    }
    
    .payroll-title {
      font-size: 14px;
      border-bottom: 2px solid #000;
      display: inline-block;
      margin-bottom: 5px;
    }

    /* EMPLOYEE & DATES SECTION */
    .employee-section {
      display: -webkit-flex;
      display: flex;
      -webkit-justify-content: space-between;
      justify-content: space-between;
      margin-bottom: 30px;
      border-top: 1px solid #ccc;
      border-bottom: 1px solid #ccc;
      padding: 15px 0;
    }
    
    .emp-details {
      line-height: 1.5;
    }
    
    .emp-name {
      font-weight: bold;
      font-size: 14px;
    }
    
    .pay-dates-table {
      border-collapse: collapse;
    }
    
    .pay-dates-table td {
      padding: 2px 10px;
      font-weight: bold;
      font-size: 11px;
    }

    /* FINANCIAL TABLES */
    .financial-section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-weight: bold; 
      margin-bottom: 5px;
    }
    
    table.financials {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    table.financials th {
      text-align: right;
      border-bottom: 1px solid #000;
      padding: 5px;
      font-weight: bold;
      font-size: 11px;
    }
    
    table.financials th:first-child {
      text-align: left;
    }
    
    table.financials td {
      text-align: right;
      padding: 5px;
      /* Border color set to black (#000) */
      border-bottom: 1px solid #000;
    }
    
    table.financials td:first-child {
      text-align: left;
    }

    /* NET PAY BOX */
    .net-pay-box {
      margin-top: 20px;
      text-align: right;
      font-size: 16px;
      font-weight: bold;
      padding: 10px;
      background: #eee;
      border: 1px solid #ccc;
      display: inline-block;
      float: right;
      min-width: 200px;
    }
    
    .ytd-net-text {
      font-size: 12px; 
      font-weight: normal; 
      margin-top: 5px; 
      color: #666;
    }

    /* FOOTER */
    .footer {
      clear: both;
      margin-top: 50px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-top: 1px dotted #ccc;
      padding-top: 10px;
    }
  </style>
</head>
<body>

<div class="page-sheet">
  
  <!-- BACKGROUND IMAGE -->
  <img src="<%= backgroundUrl %>" class="page-bg" alt="background" />

  <div class="page-content">
     
    <!-- HEADER -->
    <div class="header-row">
      <div class="company-info">
        <div>NSE MANAGEMENT INC</div>
        <div style="font-weight: normal; margin-top: 10px;">
          4711 Nutmeg Way SW<br>
          Lilburn GA 30047
        </div>
      </div>
      <div class="payroll-service-branding">
        <div class="payroll-title">NWF PAYROLL SERVICES</div>
        <div style="font-size: 10px;">PAYROLL FOR SMALL BUSINESSES & SELF-EMPLOYED</div>
      </div>
    </div>

    <!-- EMPLOYEE INFO & DATES -->
    <div class="employee-section">
      <div class="emp-details">
        <div style="font-size: 10px; color: #666; margin-bottom: 5px;">EMPLOYEE</div>
        <div class="emp-name"><%= employeeFullName %></div>
        <div style="margin-top: 5px;">Employee ID: <%= maskedEmployeeId %></div>
        <div style="margin-top: 10px;">
          <%= employeeAddressLine1 %><br>
          <% if(employeeAddressLine2){ %><%= employeeAddressLine2 %><br><% } %>
          <%= employeeCity %>, <%= employeeState %> <%= employeeZip %>
        </div>
      </div>
      
      <div>
        <table class="pay-dates-table">
          <tr>
            <td>Check Date:</td>
            <td><%= payDateFormatted %></td>
          </tr>
          <tr>
            <td>Pay Period Beginning:</td>
            <td><%= payPeriodBeginFormatted %></td>
          </tr>
          <tr>
            <td>Pay Period Ending:</td>
            <td><%= payPeriodEndFormatted %></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- EARNINGS TABLE -->
    <div class="financial-section">
      <div class="section-title">Earnings</div>
      <table class="financials">
        <thead>
          <tr>
            <th width="40%">Description</th>
            <th width="15%">Hours</th>
            <th width="15%">Rate</th>
            <th width="15%">Current</th>
            <th width="15%">YTD</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Regular</td>
            <td><%= regularHoursFormatted %></td>
            <td><%= regularRateFormatted %></td>
            <td><%= grossPay.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') %></td>
            <td><%= ytdGross.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') %></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- DEDUCTIONS TABLE -->
    <div class="financial-section">
      <div class="section-title">Deductions From Gross</div>
      <table class="financials">
        <thead>
          <tr>
            <th width="55%">Description</th>
            <th width="15%"></th>
            <th width="15%">Current</th>
            <th width="15%">YTD</th>
          </tr>
        </thead>
        <tbody>
          <!-- Gross Line -->
          <tr>
            <td><strong>Gross Pay</strong></td>
            <td></td>
            <td><strong><%= grossPay.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') %></strong></td>
            <td><strong><%= ytdGross.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') %></strong></td>
          </tr>
          
          <tr>
            <td>Federal Income Tax</td>
            <td></td>
            <td><%= formatCurrency(federalIncomeTax) %></td>
            <td><%= formatCurrency(ytdFederalIncomeTax) %></td>
          </tr>
          <tr>
            <td>Social Security (Employee)</td>
            <td></td>
            <td><%= formatCurrency(socialSecurity) %></td>
            <td><%= formatCurrency(ytdSocialSecurity) %></td>
          </tr>
          <tr>
            <td>Medicare (Employee)</td>
            <td></td>
            <td><%= formatCurrency(medicare) %></td>
            <td><%= formatCurrency(ytdMedicare) %></td>
          </tr>
          <tr>
            <td>State of GA Income Tax</td>
            <td></td>
            <td><%= formatCurrency(stateIncomeTax) %></td>
            <td><%= formatCurrency(ytdStateIncomeTax) %></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- NET PAY -->
    <div class="net-pay-box">
      NET PAY: $ <%= netPay.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') %>
      <div class="ytd-net-text">
        YTD Net: $ <%= ytdNet.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') %>
      </div>
    </div>
    <div class="clear"></div>

    <!-- FOOTER -->
    <div class="footer">
      Verify online at: <%= verificationUrl %> <br>
      Verification Code: <strong><%= verificationCode %></strong>
    </div>
  </div>
</div>
</body>
</html>
`;

/**
 * Generate paystub PDF with NWF layout.
 * @param {Object} paystub - The data object from your database
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

    // ---- Render HTML ----
    // We pass the global constant BACKGROUND_IMAGE_URL to the template
    const html = await ejs.render(PAYSTUB_TEMPLATE_V2, {
      backgroundUrl: BACKGROUND_IMAGE_URL, 
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
          border: "0", 
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
