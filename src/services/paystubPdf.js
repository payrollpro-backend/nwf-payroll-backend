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
  const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-US') : '');

const payDateFormatted = fmtDate(paystub.payDate);
const payPeriodBeginFormatted = fmtDate(paystub.payPeriodStart);
const payPeriodEndFormatted = fmtDate(paystub.payPeriodEnd);

// Employee address (from schema)
const addr = paystub.employee.address || {};
const employeeAddressLine1 = addr.line1 || '';
const employeeAddressLine2 = addr.line2 || '';
const employeeCity = addr.city || '';
const employeeState = addr.state || '';
const employeeZip = addr.zip || '';

// Employee ID + masked version (only last 6 visible)
const externalIdRaw = (paystub.employee.externalEmployeeId || '').trim();
let maskedEmployeeId = externalIdRaw;
if (externalIdRaw && externalIdRaw.length >= 6) {
  const last6 = externalIdRaw.slice(-6);
  maskedEmployeeId = 'xxxxxx' + last6;
}

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
  employeeFullName,
  employeeEmail: (paystub.employee.email || '').trim(),

  // full + masked ID
  externalEmployeeId: externalIdRaw,
  maskedEmployeeId,

  payDateFormatted,
  payPeriodBeginFormatted,
  payPeriodEndFormatted,

  checkNumber: paystub.checkNumber || '',
  bankName: paystub.bankName || '',
  bankAccountLast4: paystub.bankAccountLast4 || '',
  verificationCode: paystub.verificationCode || '',

  employeeAddressLine1,
  employeeAddressLine2,
  employeeCity,
  employeeState,
  employeeZip,

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

  regularRateFormatted: '0.00',
  regularHoursFormatted: '0.00',

  // use your blank background (band + lines, no text)
  backgroundUrl: 'https://www.nwfpayroll.com/nwf-background.png'
  // (or whatever the final URL is for that second image)
};


  // Render HTML from EJS template file
  const html = await ejs.renderFile(templatePath, templateData);

  // Convert HTML → PDF buffer
 return new Promise((resolve, reject) => {
  pdf.create(
    html,
    {
      format: 'Letter',
      border: '5mm',
      timeout: 30000,
      // Help PhantomJS/html-pdf load HTTPS assets like your background PNG
      phantomArgs: ['--ignore-ssl-errors=yes', '--ssl-protocol=any']
    }
  ).toBuffer((err, buffer) => {
    if (err) return reject(err);
    resolve(buffer);
  });
});

}

module.exports = {
  generateAdpPaystubPdf,
};
 
