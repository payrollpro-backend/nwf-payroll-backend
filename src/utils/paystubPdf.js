const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');

function generatePaystubPdf(res, employee, payroll, paystub) {
  const doc = new PDFDocument({ margin: 36 }); // 0.5" margins

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${paystub.fileName}`
  );

  doc.pipe(res);

  const logoPath = path.join(__dirname, '..', 'assets', 'nwf-logo-paystub.png');

  // Header
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('NWF Payroll', 36, 40);

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#555555')
    .text('Official Earnings Statement', 36, 60);

  try {
    doc.image(logoPath, 430, 30, { width: 120 });
  } catch (e) {
    console.warn('Logo not found for paystub PDF:', e.message);
  }

  doc
    .moveTo(36, 90)
    .lineTo(559, 90)
    .lineWidth(0.8)
    .stroke('#cccccc');

  doc.fillColor('#000000');

  const leftX = 36;
  const rightX = 320;
  const topY = 100;

  // Employee info
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('EMPLOYEE INFORMATION', leftX, topY);

  doc
    .font('Helvetica')
    .fontSize(9)
    .moveDown(0.5)
    .text(
      `${employee.firstName} ${employee.lastName}`,
      leftX,
      topY + 14
    )
    .text(employee.email || '', leftX, topY + 26);

  if (employee.companyName) {
    doc.text(employee.companyName, leftX, topY + 38);
  }
  if (employee.phone) {
    doc.text(employee.phone, leftX, topY + 50);
  }

  const periodStart = moment(payroll.periodStart).format('YYYY-MM-DD');
  const periodEnd = moment(payroll.periodEnd).format('YYYY-MM-DD');
  const payDate = moment(paystub.payDate).format('YYYY-MM-DD');

  // Pay details
  doc
    .font('Helvetica-Bold')
    .text('PAY DETAILS', rightX, topY);

  doc
    .font('Helvetica')
    .fontSize(9)
    .moveDown(0.5)
    .text(`Pay Date: ${payDate}`, rightX, topY + 14)
    .text(`Pay Period: ${periodStart} to ${periodEnd}`, rightX, topY + 26)
    .text(`Hours Worked: ${payroll.hoursWorked}`, rightX, topY + 38);

  const rate = (payroll.grossPay / (payroll.hoursWorked || 1)).toFixed(2);
  doc.text(
    `Hourly Rate: $${rate}`,
    rightX,
    topY + 50
  );

  // Boxes
  doc
    .lineWidth(0.5)
    .roundedRect(leftX - 4, topY - 4, 250, 70, 4)
    .stroke('#dddddd');

  doc
    .roundedRect(rightX - 4, topY - 4, 250, 70, 4)
    .stroke('#dddddd');

  // Earnings table
  const tableTop = 190;
  const col1 = 36;
  const col2 = 260;
  const col3 = 380;
  const col4 = 480;

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('EARNINGS', col1, tableTop);

  doc
    .moveTo(col1, tableTop + 14)
    .lineTo(559, tableTop + 14)
    .lineWidth(0.5)
    .stroke('#cccccc');

  const hdrY = tableTop + 18;
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Description', col1, hdrY)
    .text('Hours', col2, hdrY, { width: 60, align: 'right' })
    .text('Rate', col3, hdrY, { width: 60, align: 'right' })
    .text('Current Pay', col4, hdrY, { width: 80, align: 'right' });

  const rowY = hdrY + 14;
  const gross = payroll.grossPay;
  const net = payroll.netPay;

  doc
    .font('Helvetica')
    .fontSize(9)
    .text('Regular Pay', col1, rowY)
    .text(String(payroll.hoursWorked), col2, rowY, { width: 60, align: 'right' })
    .text(`$${rate}`, col3, rowY, { width: 60, align: 'right' })
    .text(`$${gross.toFixed(2)}`, col4, rowY, { width: 80, align: 'right' });

  const totalY = rowY + 18;
  doc
    .moveTo(col1, totalY)
    .lineTo(559, totalY)
    .lineWidth(0.5)
    .stroke('#cccccc');

  const summaryTop = totalY + 12;

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('SUMMARY', col1, summaryTop);

  const sY = summaryTop + 16;
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(`Gross Pay: $${gross.toFixed(2)}`, col1, sY)
    .text(`Net Pay:   $${net.toFixed(2)}`, col1, sY + 12);

  doc
    .roundedRect(col3 - 10, summaryTop + 4, 230, 40, 4)
    .stroke('#dddddd');

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('NET PAY THIS PERIOD', col3, summaryTop + 10, {
      width: 200,
      align: 'right',
    });

  doc
    .fontSize(12)
    .text(`$${net.toFixed(2)}`, col3, summaryTop + 22, {
      width: 200,
      align: 'right',
    });

  const notesTop = summaryTop + 70;

  if (payroll.notes) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('Notes', 36, notesTop);

    doc
      .font('Helvetica')
      .fontSize(9)
      .text(payroll.notes, 36, notesTop + 12, { width: 520 });
  }

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#6b7280')
    .text(
      'This statement is provided by NWF Payroll for income verification purposes only.',
      36,
      750,
      { width: 520, align: 'center' }
    );

  doc.end();
}

module.exports = { generatePaystubPdf };