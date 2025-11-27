const PDFDocument = require('pdfkit');
const path = require('path');
const PayrollRun = require('../models/PayrollRun');

function toMoney(num) {
  const n = Number(num || 0);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

// Very simple placeholder – can swap for real number-to-words later
function numberToWords(amount) {
  return `${amount.toFixed(2)} DOLLARS`;
}

async function computeYtd(employeeId, payDate) {
  const startOfYear = new Date(payDate.getFullYear(), 0, 1);

  const runs = await PayrollRun.find({
    employee: employeeId,
    payDate: { $gte: startOfYear, $lte: payDate },
  });

  return runs.reduce(
    (tot, r) => {
      tot.gross          += r.grossPay || 0;
      tot.net            += r.netPay || 0;
      tot.federalIncome  += r.federalIncomeTax || 0;
      tot.stateIncome    += r.stateIncomeTax || 0;
      tot.socialSecurity += r.socialSecurity || 0;
      tot.medicare       += r.medicare || 0;
      return tot;
    },
    {
      gross: 0,
      net: 0,
      federalIncome: 0,
      stateIncome: 0,
      socialSecurity: 0,
      medicare: 0,
    }
  );
}

async function generatePaystubPdf(res, employee, payrollRun, paystub) {
  const payDate = new Date(paystub.payDate);
  const ytdTotals = await computeYtd(employee._id, payDate);

  const doc = new PDFDocument({ size: 'LETTER', margin: 36 });

  // === Metadata for tamper checking / verification ===
  doc.info.Title = 'NWF Payroll Paystub';
  doc.info.Author = 'NWF Payroll Services';
  doc.info.Subject = 'Official paystub';
  doc.info.Keywords = 'NWF Payroll, paystub, verification';
  doc.info.CreationDate = new Date();

  const verificationTag = `NWF_PAYSTUB_${paystub._id.toString()}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${paystub.fileName || 'paystub.pdf'}"`
  );

  doc.pipe(res);

  const logoPath = path.join(__dirname, '..', 'assets', 'NWF_PAYROLL_SERVICES.png');
  try {
    doc.image(logoPath, 380, 40, { width: 160 }); // top-right, smaller
  } catch (e) {
    console.warn('Logo not found at', logoPath);
  }

  const amount = payrollRun.netPay || 0;
  const amountFormatted = toMoney(amount);

  // Header (similar to your sample)
  doc
    .fontSize(10)
    .text('NWF PAYROLL SERVICES', 40, 40)
    .moveDown(0.2);

  doc
    .fontSize(10)
    .text('Check Date', 380, 90)
    .text(payDate.toLocaleDateString('en-US'), 460, 90)
    .text('Amount', 380, 105)
    .text(amountFormatted, 460, 105);

  doc
    .fontSize(10)
    .text('Pay', 40, 120)
    .text(numberToWords(amount), 70, 120, { underline: true, width: 340 })
    .text('Dollars', 420, 120);

  doc
    .text('To The', 40, 140)
    .text(`${employee.firstName} ${employee.lastName}`, 90, 140)
    .text(employee.address?.line1 || '', 90, 154)
    .text(
      `${employee.address?.city || ''}, ${employee.address?.state || ''} ${
        employee.address?.zip || ''
      }`,
      90,
      168
    );

  doc
    .moveTo(40, 195)
    .lineTo(350, 195)
    .stroke();
  doc
    .moveTo(360, 195)
    .lineTo(560, 195)
    .stroke();

  doc.fontSize(8).text('MEMO', 40, 198).text('AUTHORIZED SIGNATURE', 410, 198);

  function drawStub(yStart) {
    const leftX = 40;
    const rightX = 320;

    doc
      .fontSize(10)
      .text(employee.companyName || 'NSE MANAGEMENT INC', leftX, yStart);

    doc
      .text(`${employee.firstName} ${employee.lastName}`, leftX, yStart + 18)
      .text(
        `Employee ID: ${employee.externalEmployeeId || 'Emp ID ----'}`,
        leftX,
        yStart + 32
      );

    doc
      .text('Check Date:', rightX, yStart + 18)
      .text(payDate.toLocaleDateString('en-US'), rightX + 80, yStart + 18)
      .text('Pay Period Beginning:', rightX, yStart + 32)
      .text(
        new Date(payrollRun.periodStart).toLocaleDateString('en-US'),
        rightX + 120,
        yStart + 32
      )
      .text('Pay Period Ending:', rightX, yStart + 46)
      .text(
        new Date(payrollRun.periodEnd).toLocaleDateString('en-US'),
        rightX + 120,
        yStart + 46
      );

    const tableY = yStart + 70;
    doc
      .fontSize(10)
      .text('Earnings', leftX, tableY)
      .text('Hours', leftX + 110, tableY)
      .text('Rate', leftX + 170, tableY)
      .text('Current', leftX + 230, tableY)
      .text('YTD', leftX + 310, tableY);

    const gross = payrollRun.grossPay || 0;

    doc
      .text('Regular', leftX, tableY + 16)
      .text((payrollRun.hoursWorked || 0).toFixed(2), leftX + 110, tableY + 16)
      .text(`$${(payrollRun.hourlyRate || 0).toFixed(2)}`, leftX + 170, tableY + 16)
      .text(toMoney(gross), leftX + 230, tableY + 16)
      .text(toMoney(ytdTotals.gross), leftX + 310, tableY + 16);

    const dedY = tableY;
    doc
      .text('Deductions From Gross:', rightX, dedY)
      .text('Current', rightX + 150, dedY)
      .text('YTD', rightX + 230, dedY);

    const lines = [
      ['Gross', gross, ytdTotals.gross],
      ['Federal Income Tax', payrollRun.federalIncomeTax, ytdTotals.federalIncome],
      ['Social Security (Employee)', payrollRun.socialSecurity, ytdTotals.socialSecurity],
      ['Medicare (Employee)', payrollRun.medicare, ytdTotals.medicare],
      ['State of GA Income Tax', payrollRun.stateIncomeTax, ytdTotals.stateIncome],
    ];

    let rowY = dedY + 16;
    lines.forEach(([label, current, ytd]) => {
      doc
        .text(label, rightX, rowY)
        .text(toMoney(current), rightX + 150, rowY)
        .text(toMoney(ytd), rightX + 230, rowY);
      rowY += 14;
    });

    doc
      .fontSize(10)
      .text('Net Pay:', rightX, rowY + 14)
      .text(toMoney(payrollRun.netPay), rightX + 60, rowY + 14)
      .text(toMoney(ytdTotals.net), rightX + 150, rowY + 14);
  }

  drawStub(230);
  drawStub(430);

  doc
    .fontSize(10)
    .text(employee.companyName || 'NSE MANAGEMENT INC', 40, 650)
    .text('4711 Nutmeg Way SW', 40, 664)
    .text('Lilburn, GA 30047', 40, 678);

  doc.save();
  doc
    .fontSize(6)
    .fillColor('#000000')
    .opacity(0.05)
    .text(verificationTag, 40, 710);
  doc.restore();

  doc.end();
}

module.exports = { generatePaystubPdf };
