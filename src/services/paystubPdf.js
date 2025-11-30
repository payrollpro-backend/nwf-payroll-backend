// src/services/paystubPdf.js

const ejs = require("ejs");
const pdf = require("html-pdf");
const path = require("path");

/**
 * --------------------------------------------------------------------
 *  PAYSTUB TEMPLATE (HTML will be replaced with your CorelDRAW layout)
 * --------------------------------------------------------------------
 */
const PAYSTUB_TEMPLATE_V2 = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>NWF Paystub</title>
<style>
  body {
    font-family: Arial, sans-serif;
    font-size: 12px;
    margin: 0;
    padding: 0;
  }

  .page-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }

  .content {
    position: relative;
    padding: 40px;
  }

  h1 {
    font-size: 18px;
    margin-bottom: 10px;
  }

  .label {
    font-weight: bold;
  }
</style>
</head>
<body>

<img src="<%= backgroundUrl %>" class="page-bg" />

<div class="content">
  <h1>Paystub</h1>

  <!-- EMPLOYEE INFO -->
  <p class="label">Employee Name:</p>
  <p><%= employeeFullName %></p>

  <p class="label">Employee ID:</p>
  <p><%= maskedEmployeeId %></p>

  <!-- PAY INFO -->
  <p class="label">Pay Date:</p>
  <p><%= payDateFormatted %></p>

  <p class="label">Gross Pay:</p>
  <p>$<%= grossPay.toFixed(2) %></p>

  <p class="label">Net Pay:</p>
  <p>$<%= netPay.toFixed(2) %></p>

</div>
</body>
</html>
`;

/**
 * --------------------------------------------------------------------
 *  MAIN PDF GENERATOR
 * --------------------------------------------------------------------
 */
async function generateAdpPaystubPdf(paystub) {
  try {
    // --------------------------------------------
    // Extract paystub fields
    // --------------------------------------------
    const payDate = paystub.payDate ? new Date(paystub.payDate) : new Date();
    const payDateFormatted = payDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const employeeFirstName = paystub.employee?.firstName || "";
    const employeeLastName = paystub.employee?.lastName || "";
    const employeeFullName = `${employeeFirstName} ${employeeLastName}`.trim();

    const fullEmployeeId = paystub.employee.externalEmployeeId || "";
    const maskedEmployeeId =
      fullEmployeeId.length > 6
        ? "XXXXXX" + fullEmployeeId.slice(-6)
        : fullEmployeeId;

    const grossPay = Number(paystub.grossPay || 0);
    const netPay = Number(paystub.netPay || 0);

    // --------------------------------------------
    // CorelDRAW Background Image
    // --------------------------------------------
    const backgroundUrl = "https://www.nwfpayroll.com/nwf-paystub-bg.png";

    // --------------------------------------------
    // Build HTML with EJS
    // --------------------------------------------
    const html = await ejs.render(PAYSTUB_TEMPLATE_V2, {
      employeeFullName,
      employeeFirstName,
      employeeLastName,
      maskedEmployeeId,
      payDateFormatted,
      grossPay,
      netPay,
      backgroundUrl,
    });

    // --------------------------------------------
    // Create PDF Buffer
    // --------------------------------------------
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
    console.error("❌ PDF GENERATION ERROR:", err);
    throw err;
  }
}

module.exports = {
  generateAdpPaystubPdf,
};
