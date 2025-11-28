// src/utils/paystubPdf.js
const PDFDocument = require('pdfkit');

/**
 * generatePaystubPdf
 *
 * @param {Response} res - Express response (we will stream PDF)
 * @param {Object} employee - Employee document
 * @param {Object} run - PayrollRun document
 * @param {Object} stub - Paystub document
 */
function generatePaystubPdf(res, employee, run, stub) {
  const doc = new PDFDocument({ margin: 36 }); // 0.5" margins

  const fileName = stub?.fileName || 'paystub.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileName}"`
  );

  doc.pipe(res);

  // Helper: money format
  const money = (n) =>
    typeof n === 'number' ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

  // --------- HEADER (Employer + Logo placeholder) ----------
  const companyName =
    run?.companyName ||
    employee?.companyName ||
    'NWF PAYROLL SERVICES';

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(companyName, 36, 40);

  doc
    .fontSize(9)
    .font('Helvetica')
    .text('Official Pay Statement', 36, 60);

  // (If later you host your logo at a URL, you can download it first
  // and then doc.image(localPath, x, y, { width: 80 }))

  // --------- EMPLOYER + EMPLOYEE BLOCK ----------
  const empFullName = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(' ');

  const externalId =
    employee.externalEmployeeId ||
    employee.employeeId ||
    (employee._id && `Emp_${String(employee._id).slice(-8)}`);

  const addr = employee.address || {};
  const payDate = stub.payDate || run.payDate;
  const periodStart = run.periodStart;
  const periodEnd = run.periodEnd;

  // Left column: Employee
  let y = 90;
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Employee', 36, y);
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(empFullName || 'Employee', 36, y + 14);
  if (externalId) {
    doc.text(`Employee ID: ${externalId}`, 36, y + 28);
  }
  if (addr.line1 || addr.city) {
    doc.text(
      [
        addr.line1,
        addr.line2,
        [addr.city, addr.state, addr.zip].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join('\n'),
      36,
      y + 42
    );
  }

  // Right column: Pay details
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Pay Details', 320, y);
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(
      `Pay Date: ${payDate ? new Date(payDate).toLocaleDateString() : ''}`,
      320,
      y + 14
    );
  doc.text(
    `Period: ${
      periodStart ? new Date(periodStart).toLocaleDateString() : '—'
    }  –  ${
      periodEnd ? new Date(periodEnd).toLocaleDateString() : '—'
    }`,
    320,
    y + 28
  );
  if (run.payFrequency) {
    doc.text(`Frequency: ${run.payFrequency}`, 320, y + 42);
  }
  if (run.payType) {
    doc.text(`Pay Type: ${run.payType}`, 320, y + 56);
  }

  // Divider line
  doc.moveTo(36, 150).lineTo(559, 150).strokeColor('#cccccc').stroke();

  // --------- EARNINGS (CURRENT vs YTD) ----------
  y = 165;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#000000')
    .text('Earnings', 36, y);
  y += 18;

  // table headers
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Description', 36, y);
  doc.text('Current', 260, y, { width: 80, align: 'right' });
  doc.text('YTD', 400, y, { width: 80, align: 'right' });

  y += 14;
  doc.moveTo(36, y).lineTo(559, y).strokeColor('#dddddd').stroke();
  y += 6;

  // Gross
  doc
    .font('Helvetica')
    .fontSize(9)
    .text('Gross Pay', 36, y);
  doc.text(money(run.grossPay), 260, y, { width: 80, align: 'right' });
  doc.text(money(run.ytdGross), 400, y, { width: 80, align: 'right' });
  y += 14;

  // Net
  doc.text('Net Pay', 36, y);
  doc.text(money(run.netPay), 260, y, { width: 80, align: 'right' });
  doc.text(money(run.ytdNet), 400, y, { width: 80, align: 'right' });
  y += 20;

  doc
    .font('Helvetica-Bold')
    .text('Net Pay This Period:', 36, y);
  doc
    .font('Helvetica-Bold')
    .text(`$${money(run.netPay)}`, 260, y, { width: 120, align: 'right' });

  // --------- TAXES / DEDUCTIONS ----------
  y += 30;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Taxes & Deductions', 36, y);
  y += 18;

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Description', 36, y);
  doc.text('Current', 260, y, { width: 80, align: 'right' });
  doc.text('YTD', 400, y, { width: 80, align: 'right' });

  y += 14;
  doc.moveTo(36, y).lineTo(559, y).strokeColor('#dddddd').stroke();
  y += 6;

  const lines = [
    {
      label: 'Federal Income Tax',
      curr: run.federalIncomeTax,
      ytd: run.ytdFederalIncomeTax,
    },
    {
      label: 'State Income Tax',
      curr: run.stateIncomeTax,
      ytd: run.ytdStateIncomeTax,
    },
    {
      label: 'Social Security',
      curr: run.socialSecurity,
      ytd: run.ytdSocialSecurity,
    },
    {
      label: 'Medicare',
      curr: run.medicare,
      ytd: run.ytdMedicare,
    },
    {
      label: 'Total Taxes',
      curr: run.totalTaxes,
      ytd: run.ytdTotalTaxes,
    },
  ];

  doc.font('Helvetica').fontSize(9);

  lines.forEach((row) => {
    doc.text(row.label, 36, y);
    doc.text(`$${money(row.curr)}`, 260, y, { width: 80, align: 'right' });
    doc.text(`$${money(row.ytd)}`, 400, y, { width: 80, align: 'right' });
    y += 14;
  });

  // --------- FOOTER / SECURITY LINE ----------
  y += 20;
  doc
    .fontSize(8)
    .fillColor('#555555')
    .text(
      'This pay statement is generated by NWF Payroll Services. ' +
        'Altering figures on this document may be detectable via internal metadata records.',
      36,
      y,
      { width: 523 }
    );

  doc.end();
}

module.exports = {
  generatePaystubPdf,
};
