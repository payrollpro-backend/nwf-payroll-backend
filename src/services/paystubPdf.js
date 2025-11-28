const ejs = require('ejs');
const path = require('path');
const pdf = require('html-pdf');
const fetch = require('node-fetch'); // Assuming you use node-fetch or similar

/**
 * Helper to fetch a URL and return a Base64 data URI.
 * In a real app, you would cache this result instead of fetching every time.
 */
async function getBase64Image(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        // Fetch the raw buffer
        const buffer = await response.buffer();
        // Determine mime type from headers (or assume if necessary)
        const mimeType = response.headers.get('content-type') || 'image/png';
        // Convert buffer to Base64 string and prepend data URI prefix
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error('Error converting background image to Base64:', error.message);
        // Fallback to a blank string if the fetch fails
        return '';
    }
}

/**
 * Build ADP-style paystub PDF from a Paystub mongoose document.
 * Returns: Promise<Buffer>
 */
async function generateAdpPaystubPdf(paystub) {
    if (!paystub || !paystub.employee) {
        throw new Error('Paystub or employee missing');
    }

    // --- BASE64 PRE-LOADING STEP: Ensure this happens before rendering ---
    const rawBackgroundUrl = 'https://www.nwfpayroll.com/nwf-paystub-bg.png';
    const base64Background = await getBase64Image(rawBackgroundUrl);
    // ---------------------------------

    const employeeFullName = `${paystub.employee.firstName || ''} ${paystub.employee.lastName || ''}`.trim();
    
    const payDate = paystub.payDate ? new Date(paystub.payDate) : null;
    const payDateFormatted = payDate
      ? payDate.toLocaleDateString('en-US')
      : '';

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

        // ... (rest of the data) ...
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
        ytdMedicare: Number(paystub.medicare || 0),
        ytdTotalTaxes: Number(paystub.totalTaxes || 0),

        // you can wire real rate/hours later
        regularRateFormatted: '0.00',
        regularHoursFormatted: '0.00',

        // Pass the Base64 string to the template
        backgroundUrl: base64Background 
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
