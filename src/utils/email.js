const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_HOST) {
    console.warn('EMAIL_HOST not set; welcome emails will be skipped.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

async function sendWelcomeEmail(to, tempPassword) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('No email transporter configured; skipping welcome email.');
    return;
  }

  const loginUrl = process.env.APP_LOGIN_URL || '#';

  await transport.sendMail({
    from: process.env.EMAIL_FROM || 'NWF Payroll <no-reply@example.com>',
    to,
    subject: 'Your NWF Payroll login details',
    text: `Welcome to NWF Payroll.

You can log in at: ${loginUrl}

Temporary password: ${tempPassword}

Please log in and change your password as soon as possible.`,
  });
}

module.exports = { sendWelcomeEmail };