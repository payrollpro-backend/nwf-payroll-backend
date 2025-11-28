// src/services/paystubPdf.js
const ejs = require('ejs');
const path = require('path');
const pdf = require('html-pdf');

/**
 * Build ADP-style paystub PDF from a Paystub mongoose document.
 * Returns: Promise<Buffer>
 */
async function generateAdpPaystubPdf(paystub) {
  if (!paystub || !paystub.employee) {
    throw new Error('Paystub or employee missing');
  }

  const employeeFullName = `${paystub.employee.firstName || ''} ${paystub.employee.lastName || ''}`.trim();

  const payDate = paystub.payDate ? new Date(paystub.payDate) : null;
  const payDateFormatted = payDate
    ? payDate.toLocaleDateString('en-US')
    : '';

  // If you add payPeriodStart/payPeriodEnd later, we can show them.
  let payPeriodLabel = '—';
  if (paystub.payPeriodStart && paystub.payPeriodEnd) {
    const start = new Date(paystub.payPeriodStart);
    const end = new Date(paystub.payPeriodEnd);
    const fmt = (d) => d.toLocaleDateString('en-US');
    payPeriodLabel = `${fmt(start)} - ${fmt(end)}`;
  }

  const templatePath = path.join(__dirname, '../templates/paystub-adp-template.ejs');

  const templateData = {
    // top-level info
    employeeFullName,
    employeeEmail: (paystub.employee.email || '').trim(),
    externalEmployeeId: paystub.employee.externalEmployeeId || '',
    payDateFormatted,
    payPeriodLabel,

    checkNumber: paystub.checkNumber || '',
    bankName: paystub.bankName || '',
    bankAccountLast4: paystub.bankAccountLast4 || '',
    verificationCode: paystub.verificationCode || '',

    // money fields – default to 0 so toFixed() is safe
    grossPay: Number(paystub.grossPay || 0),
    netPay: Number(paystub.netPay || 0),

    federalIncomeTax: Number(paystub.federalIncomeTax || 0),
    stateIncomeTax: Number(paystub.stateIncomeTax || 0),
    socialSecurity: Number(paystub.socialSecurity || 0),
    medicare: Number(paystub.medicare || 0),
    totalTaxes: Number(paystub.totalTaxes || 0),

    ytdGross: Number(paystub.ytdGross || 0),
    ytdNet: Number(paystub.ytdNet || 0),
    ytdFederalIncomeTax: Number(paystub.ytdFederalIncomeTax || 0),
    ytdStateIncomeTax: Number(paystub.ytdStateIncomeTax || 0),
    ytdSocialSecurity: Number(paystub.ytdSocialSecurity || 0),
    ytdMedicare: Number(paystub.ytdMedicare || 0),
    ytdTotalTaxes: Number(paystub.ytdTotalTaxes || 0),

    // you can wire real rate/hours later
    regularRateFormatted: '0.00',
    regularHoursFormatted: '0.00',

    // background for the stub
    backgroundUrl: 'https://www.nwfpayroll.com/nwf-paystub-bg.png'
  };

  // Render HTML from EJS template file
  const html = await ejs.renderFile(templatePath, templateData);

  // Convert HTML → PDF buffer
  return new Promise((resolve, reject) => {
    pdf.create(html, { format: 'Letter', border: '5mm' }).toBuffer((err, buffer) => {
      if (err) return reject(err);
      resolve(buffer);
    });
  });
}

module.exports = {
  generateAdpPaystubPdf,
};
 
