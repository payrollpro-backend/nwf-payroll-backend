// src/utils/paystubPdf.js

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'nwf-payroll-logo.png');

function money(n) {
  const num = Number.isFinite(Number(n)) ? Number(n) : 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US');
}

/**
 * Draw one 1080 stub section (top or bottom)
 */
function drawStub(doc, x, y, data) {
  const {
    employerName,
    employerAddress,
    employeeName,
    employeeAddress,
    employeeId,
    checkDate,
    checkAmount,
    payPeriodStart,
    payPeriodEnd,
    memo,
    checkNumber,
    gross,
    hours,
    rate,
    federal,
    state,
    socialSecurity,
    medicare,
    totalTaxes,
    net,
    ytd,
  } = data;

  const lineHeight = 14;

  // OUTER BOX
  doc.rect(x, y, 540, 340).stroke();

  // --- HEADER: LOGO + CHECK INFO ---
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, x + 10, y + 10, { width: 120 });
  } else {
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('NWF PAYROLL SERVICES', x + 10, y + 18);
  }

  // Check Date / Amount
  doc
    .fontSize(10)
    .font('Helvetica')
    .text('Check Date', x + 360, y + 20);
  doc
    .font('Helvetica-Bold')
    .text(fmtDate(checkDate), x + 430, y + 20, { width: 90, align: 'right' });

  doc
    .font('Helvetica')
    .text('Amount', x + 360, y + 36);
  doc
    .font('Helvetica-Bold')
    .text(money(checkAmount), x + 430, y + 36, {
      width: 90,
      align: 'right',
    });

  // --- PAY TO THE ORDER OF ---
  let cursorY = y + 70;
  doc
    .fontSize(10)
    .font('Helvetica')
    .text('Pay', x + 10, cursorY);

  doc
    .font('Helvetica-Bold')
    .text(employeeName || '', x + 60, cursorY, {
      continued: true,
    });

  doc
    .font('Helvetica')
    .text(' Dollars', x + 320, cursorY);

  cursorY += lineHeight + 6;

  if (employeeAddress) {
    doc
      .font('Helvetica')
      .text('To The', x + 10, cursorY);
    doc
      .font('Helvetica-Bold')
      .text(employeeName || '', x + 60, cursorY);

    cursorY += lineHeight;
    doc
      .font('Helvetica')
      .text(employeeAddress, x + 60, cursorY);
    cursorY += lineHeight;
  }

  // Memo + Signature line
  cursorY += 8;
  doc
    .moveTo(x + 10, cursorY)
    .lineTo(x + 260, cursorY)
    .stroke();
  doc.fontSize(9).text('Memo', x + 10, cursorY + 3);

  doc
    .moveTo(x + 280, cursorY)
    .lineTo(x + 530, cursorY)
    .stroke();
  doc.text('AUTHORIZED SIGNATURE', x + 340, cursorY + 3, {
    width: 180,
    align: 'center',
  });

  cursorY += 40;

  // Employer name centered (big, like sample bottom)
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(employerName, x + 10, cursorY, {
      width: 520,
      align: 'left',
    });

  cursorY += lineHeight;

  if (employerAddress) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(employerAddress, x + 10, cursorY);
  }

  // ---- EARNINGS / DEDUCTIONS TABLE ----
  // Left half: Earnings
  const tableTop = y + 170;
  const leftX = x + 10;
  const rightX = x + 270;

  // Section title "Earnings"
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Earnings', leftX, tableTop);
  doc.text('Hours', leftX + 130, tableTop);
  doc.text('Rate', leftX + 180, tableTop);
  doc.text('Current', leftX + 230, tableTop);
  doc.text('YTD', leftX + 310, tableTop);

  // Underline
  doc
    .moveTo(leftX, tableTop + 12)
    .lineTo(leftX + 360, tableTop + 12)
    .stroke();

  const earningsRowY = tableTop + 20;

  doc.font('Helvetica').fontSize(10);
  doc.text('Regular', leftX, earningsRowY);
  doc.text(hours != null ? hours.toFixed(2) : '', leftX + 130, earningsRowY, {
    width: 40,
    align: 'right',
  });
  doc.text(rate != null ? rate.toFixed(2) : '', leftX + 180, earningsRowY, {
    width: 40,
    align: 'right',
  });
  doc.text(money(gross), leftX + 230, earningsRowY, {
    width: 70,
    align: 'right',
  });
  doc.text(money(ytd.gross), leftX + 310, earningsRowY, {
    width: 70,
    align: 'right',
  });

  // Right half: Deductions From Gross
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Deductions From Gross:', rightX, tableTop);

  doc.font('Helvetica');
  const dedLabelX = rightX;
  const dedCurX = rightX + 130;
  const dedYtdX = rightX + 210;
  let dY = tableTop + 20;

  function dedRow(label, cur, ytdVal) {
    doc.text(label, dedLabelX, dY);
    doc.text(money(cur), dedCurX, dY, { width: 70, align: 'right' });
    doc.text(money(ytdVal), dedYtdX, dY, { width: 70, align: 'right' });
    dY += lineHeight;
  }

  dedRow('Gross', gross, ytd.gross);
  dedRow('Federal Income Tax', federal, ytd.federal);
  dedRow('Social Security (Employee)', socialSecurity, ytd.socialSecurity);
  dedRow('Medicare (Employee)', medicare, ytd.medicare);
  dedRow('State Income Tax', state, ytd.state);

  // Net pay line
  const netY = y + 310;
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('Net Pay:', leftX, netY);
  doc.text(money(net), leftX + 70, netY, { width: 100, align: 'left' });

  doc
    .font('Helvetica')
    .fontSize(8)
    .text(money(ytd.net) + ' YTD Net', leftX + 180, netY + 2);
}

/**
 * Main generator function.
 * @param {ServerResponse} res
 * @param {Employee} employee
 * @param {PayrollRun} run
 * @param {Paystub} stub
 * @param {Object} ytd  – {gross, federal, state, socialSecurity, medicare, totalTaxes, net}
 */
function generatePaystubPdf(res, employee, run, stub, ytd = {}) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 36 });

  // Pipe to response (headers set in route)
  doc.pipe(res);

  const payDate = run.payDate || stub.payDate;
  const periodStart = run.periodStart || run.payPeriodStart;
  const periodEnd = run.periodEnd || run.payPeriodEnd;

  const gross = Number(run.grossPay || 0);
  const federal = Number(run.federalIncomeTax || 0);
  const state = Number(run.stateIncomeTax || 0);
  const ss = Number(run.socialSecurity || 0);
  const med = Number(run.medicare || 0);
  const totalTaxes =
    Number(run.totalTaxes || 0) || federal + state + ss + med;
  const net = Number(run.netPay || (gross - totalTaxes));

  // Fallbacks for YTD if for some reason not passed
  const ytdSafe = {
    gross: ytd.gross != null ? ytd.gross : gross,
    federal: ytd.federal != null ? ytd.federal : federal,
    state: ytd.state != null ? ytd.state : state,
    socialSecurity:
      ytd.socialSecurity != null ? ytd.socialSecurity : ss,
    medicare: ytd.medicare != null ? ytd.medicare : med,
    totalTaxes:
      ytd.totalTaxes != null ? ytd.totalTaxes : totalTaxes,
    net: ytd.net != null ? ytd.net : net,
  };

  const employerName =
    employee.companyName || 'NSE MANAGEMENT INC';
  const employerAddress = employee.companyAddress
    ? [
        employee.companyAddress.line1,
        employee.companyAddress.city,
        employee.companyAddress.state,
        employee.companyAddress.zip,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const employeeName =
    [employee.firstName, employee.lastName].filter(Boolean).join(' ');
  const employeeAddress = employee.address
    ? [
        employee.address.line1,
        employee.address.line2,
        employee.address.city,
        employee.address.state,
        employee.address.zip,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const data = {
    employerName,
    employerAddress,
    employeeName,
    employeeAddress,
    employeeId:
      employee.externalEmployeeId ||
      employee.employeeId ||
      employee._id.toString(),
    checkDate: payDate,
    checkAmount: net,
    payPeriodStart: periodStart,
    payPeriodEnd: periodEnd,
    memo: '',
    checkNumber: stub._id.toString().slice(-8),
    gross,
    hours: run.hoursWorked || 0,
    rate: run.hourlyRate || employee.hourlyRate || 0,
    federal,
    state,
    socialSecurity: ss,
    medicare: med,
    totalTaxes,
    net,
    ytd: ytdSafe,
  };

  // Top stub
  drawStub(doc, 36, 36, data);
  // Bottom stub (copy)
  drawStub(doc, 36, 396, data);

  doc.end();
}

module.exports = {
  generatePaystubPdf,
};
