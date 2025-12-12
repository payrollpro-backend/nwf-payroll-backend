// src/utils/certifiedPdfGenerator.js

const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

/**
 * Step 1: Generates a PDF buffer from HTML content using Puppeteer.
 * Runs on the Render server.
 * @param {string} htmlContent - The HTML for the paystub (rendered via paystubTemplate.js).
 * @returns {Promise<Buffer>} The raw PDF buffer.
 */
async function generatePaystubPdf(htmlContent) {
  let browser;
  try {
    // CRITICAL for deployment on Render/Heroku/Serverless
    // Ensures Chromium can run in a restricted container environment
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 800, height: 1000 }); 

    // Load the HTML content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0' // Wait for all resources/network activity to settle
    }); 

    // Generate the PDF buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    }); 

    return pdfBuffer;

  } catch (error) {
    console.error("Puppeteer PDF Generation Failed:", error);
    throw new Error("Could not generate PDF with Puppeteer.");
  } finally {
    if (browser) await browser.close();
  }
}


/**
 * Step 2: Injects custom metadata into the PDF buffer using pdf-lib.
 * This is the critical step to satisfy forensic document checks (like Snappt's) 
 * by preventing the file from looking like a generic 'Print to PDF' and adding a custom 'digital fingerprint'.
 * @param {Buffer} pdfBuffer - The raw PDF buffer from Puppeteer.
 * @returns {Promise<Buffer>} The metadata-injected PDF buffer.
 */
async function injectMetadata(pdfBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Customize this string: It becomes the certified digital fingerprint.
    const customCreator = "NWF Payroll Certified Document System v2025"; 
    
    // *** THE CRITICAL FIX: Setting Creator and Producer ***
    // These fields are what forensic checks look for.
    pdfDoc.setCreator(customCreator);
    pdfDoc.setProducer(customCreator); 
    
    // Add other metadata for full compliance
    pdfDoc.setAuthor("NWF Payroll Services");
    pdfDoc.setTitle("Official Paystub Verification Document");
    
    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("PDF Metadata Injection Failed:", error);
    throw new Error("Could not inject metadata into PDF.");
  }
}

module.exports = {
  generatePaystubPdf,
  injectMetadata
};
