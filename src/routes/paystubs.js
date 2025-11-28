// PDF generation (pdfkit) – ADP-style check + earnings stub
router.get('/:id/pdf', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) {
      return res.status(404).send('Paystub not found');
    }

    const payrollRunDoc =
      PayrollRun && stub.payrollRun
        ? await PayrollRun.findById(stub.payrollRun)
        : null;

    const employee = stub.employee || {};
    const firstName = employee.firstName || '';
    const lastName = employee.lastName || '';
    const email = employee.email || '';
    const externalEmployeeId = employee.externalEmployeeId || '';
    const employeeFullName = `${firstName} ${lastName}`.trim() || 'Employee';

    // Company block
    const companyName = 'NSE MANAGEMENT INC';
    const companyAddressLine1 = '4711 Nutmeg Way SW';
    const companyAddressLine2 = 'Lilburn, GA 30047';

    // Pay + tax data
    const payDateStr = stub.payDate
      ? new Date(stub.payDate).toISOString().slice(0, 10)
      : '';

    const gross = Number(stub.grossPay || 0);
    const net = Number(stub.netPay || 0);
    const fed = Number(stub.federalIncomeTax || 0);
    const state = Number(stub.stateIncomeTax || 0);
    const ss = Number(stub.socialSecurity || 0);
    const med = Number(stub.medicare || 0);
    const totalTaxes = Number(
      stub.totalTaxes || fed + state + ss + med
    );

    const ytdGross = Number(stub.ytdGross || 0);
    const ytdNet = Number(stub.ytdNet || 0);
    const ytdFed = Number(stub.ytdFederalIncomeTax || 0);
    const ytdState = Number(stub.ytdStateIncomeTax || 0);
    const ytdSs = Number(stub.ytdSocialSecurity || 0);
    const ytdMed = Number(stub.ytdMedicare || 0);
    const ytdTotalTaxes = Number(
      stub.ytdTotalTaxes || ytdFed + ytdState + ytdSs + ytdMed
    );

    const hours = Number(stub.hoursWorked || 0);
    const rate = Number(stub.hourlyRate || 0);

    const fileName =
      stub.fileName ||
      `nwf_${externalEmployeeId || 'employee'}_${payDateStr || 'date'}.pdf`;

    const formatNum = (n) => Number(n || 0).toFixed(2);

    const verificationCode = (stub.verificationCode || '').toString();
    const baseVerifyUrl =
      process.env.NWF_VERIFY_BASE_URL ||
      'https://nwf-payroll-backend.onrender.com/api/verify-paystub';
    const verificationUrl = verificationCode
      ? `${baseVerifyUrl}/${verificationCode}`
      : baseVerifyUrl;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    doc.pipe(res);

    // =======================
    // TOP CHECK AREA (ADP-like)
    // =======================
    let y = 36;

    // Brand block
    doc.fontSize(16).text('NWF PAYROLL SERVICES', 36, y);
    y += 16;
    doc.fontSize(9).text('PAYROLL SERVICES', 36, y);

    // Check info box (right)
    doc.fontSize(9);
    doc.text('Check Date:', 400, 40);
    doc.text(payDateStr || '—', 480, 40);
    doc.text('Amount:', 400, 55);
    doc.text(`$${formatNum(net)}`, 480, 55);

    // Payee lines
    y = 82;
    doc.fontSize(10).text('Pay to the Order of', 36, y);
    doc.moveTo(140, y + 10).lineTo(380, y + 10).stroke();
    doc.text(employeeFullName, 145, y);

    // Written amount placeholder
    y += 24;
    doc.text('Amount in Words', 36, y);
    doc.moveTo(120, y + 10).lineTo(560, y + 10).stroke();

    // Memo + signature
    y += 28;
    doc.text('Memo', 36, y);
    doc.moveTo(70, y + 10).lineTo(320, y + 10).stroke();

    doc.text('AUTHORIZED SIGNATURE', 360, y + 12, { align: 'right' });
    doc.moveTo(320, y + 10).lineTo(560, y + 10).stroke();

    // Tear line (simple, no dashed to avoid any pdfkit version quirks)
    y += 40;
    doc.moveTo(36, y).lineTo(576, y).stroke();

    // =======================
    // BOTTOM EARNINGS STUB
    // =======================
    y += 16;

    // Employer + employee info
    doc.fontSize(10).text(companyName, 36, y);
    y += 12;
    doc.text(companyAddressLine1, 36, y);
    y += 12;
    doc.text(companyAddressLine2, 36, y);

    // Employee block on right
    const empBlockTop = y - 24;
    doc.text(employeeFullName, 360, empBlockTop);
    doc.text(`Employee ID: ${externalEmployeeId || '—'}`, 360, empBlockTop + 12);
    doc.text(email || '—', 360, empBlockTop + 24);

    // Pay period info under employee block if we have payrollRun
    let rY = empBlockTop + 42;
    if (
      payrollRunDoc &&
      payrollRunDoc.periodStart &&
      payrollRunDoc.periodEnd
    ) {
      const pb = new Date(payrollRunDoc.periodStart)
        .toISOString()
        .slice(0, 10);
      const pe = new Date(payrollRunDoc.periodEnd)
        .toISOString()
        .slice(0, 10);
      doc.fontSize(9).text('Pay Period:', 360, rY);
      doc.text(`${pb} - ${pe}`, 430, rY);
    }

    // Move cursor down a bit
    y += 40;

    // === Earnings table header ===
    const earnHeaderY = y;
    doc.fontSize(9).text('EARNINGS', 36, earnHeaderY);
    doc.text('Rate', 210, earnHeaderY, { width: 60, align: 'right' });
    doc.text('Hours', 270, earnHeaderY, { width: 60, align: 'right' });
    doc.text('This Period', 330, earnHeaderY, { width: 80, align: 'right' });
    doc.text('YTD', 410, earnHeaderY, { width: 80, align: 'right' });

    y = earnHeaderY + 14;

    // Regular Pay row
    doc.text('Regular Pay', 36, y);
    doc.text(formatNum(rate), 210, y, { width: 60, align: 'right' });
    doc.text(hours ? hours.toFixed(2) : '', 270, y, {
      width: 60,
      align: 'right',
    });
    doc.text(formatNum(gross), 330, y, { width: 80, align: 'right' });
    doc.text(formatNum(ytdGross), 410, y, { width: 80, align: 'right' });

    // Total earnings row
    y += 16;
    doc.fontSize(9).text('Total Earnings', 36, y);
    doc.text(formatNum(gross), 330, y, { width: 80, align: 'right' });
    doc.text(formatNum(ytdGross), 410, y, { width: 80, align: 'right' });

    // === Deductions header ===
    y += 24;
    const dedHeaderY = y;
    doc.fontSize(9).text('DEDUCTIONS', 36, dedHeaderY);
    doc.text('Current', 330, dedHeaderY, { width: 80, align: 'right' });
    doc.text('YTD', 410, dedHeaderY, { width: 80, align: 'right' });

    y = dedHeaderY + 14;

    const drawDed = (label, cur, ytd) => {
      doc.text(label, 36, y);
      doc.text(`(${formatNum(cur)})`, 330, y, { width: 80, align: 'right' });
      doc.text(`(${formatNum(ytd)})`, 410, y, { width: 80, align: 'right' });
      y += 12;
    };

    drawDed('Federal Income Tax', fed, ytdFed);
    drawDed('Social Security (Employee)', ss, ytdSs);
    drawDed('Medicare (Employee)', med, ytdMed);
    drawDed('State Income Tax', state, ytdState);

    // Total taxes row
    y += 4;
    doc.fontSize(9).text('Total Taxes', 36, y);
    doc.text(`(${formatNum(totalTaxes)})`, 330, y, {
      width: 80,
      align: 'right',
    });
    doc.text(`(${formatNum(ytdTotalTaxes)})`, 410, y, {
      width: 80,
      align: 'right',
    });

    // === Net Pay summary ===
    y += 24;
    doc.fontSize(10).text('Net Pay This Period:', 36, y);
    doc.text(`$${formatNum(net)}`, 170, y, { width: 80, align: 'right' });

    y += 16;
    doc.fontSize(9).text('YTD Net Pay:', 36, y);
    doc.text(`$${formatNum(ytdNet)}`, 170, y, { width: 80, align: 'right' });

    // ===== Company Footer Block (ADP-Style) =====
    y += 32;
    doc
      .fontSize(9)
      .fillColor('#111827')
      .text(companyName, 36, y);

    doc.moveDown(0.2);
    doc
      .fontSize(8)
      .fillColor('#4B5563')
      .text(companyAddressLine1, 36, doc.y);
    doc
      .fontSize(8)
      .text(companyAddressLine2, 36, doc.y);

    doc.moveDown(0.3);
    doc
      .fontSize(7)
      .fillColor('#6B7280')
      .text(
        'This statement has been prepared by NWF Payroll Services.',
        36,
        doc.y
      );

    doc.moveDown(1.2);

    // ===== Verification Block =====
    if (verificationCode) {
      doc
        .fontSize(8)
        .fillColor('#6B7280')
        .text('Verification', 36, doc.y);

      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor('#111827')
        .text(`Code: ${verificationCode}`, 36, doc.y);

      doc.moveDown(0.3);
      doc
        .fontSize(8)
        .fillColor('#6B7280')
        .text('Verify online at:', 36, doc.y);
      doc
        .fontSize(9)
        .fillColor('#111827')
        .text(verificationUrl, 120, doc.y - 2);
    }

    // Reset color and finalize
    doc.fillColor('#000000');
    doc.end();
  } catch (err) {
    console.error('Error generating paystub PDF (ADP-style):', err);
    res.status(500).send('Error generating paystub PDF');
  }
});
