// src/utils/certifiedPdfGenerator.js

const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

// ... (generatePaystubPdf function remains the same) ...

/**
 * Step 2: Injects custom metadata into the PDF buffer using pdf-lib.
 * This is the critical step to satisfy forensic document checks (like Snappt's).
 * @param {Buffer} pdfBuffer - The raw PDF buffer from Puppeteer.
 * @returns {Promise<Buffer>} The metadata-injected PDF buffer.
 */
async function injectMetadata(pdfBuffer) {
  try {
    // 💡 FIX 1: Ensure PDFDocument.load() has the data in a reliable format.
    // If pdfBuffer is a Node.js Buffer, using pdfBuffer.buffer often works, 
    // but a simpler method is often just loading the Buffer directly.
    const pdfDoc = await PDFDocument.load(pdfBuffer); 
    
    // Customize this string: It becomes the certified digital fingerprint.
    const customCreator = "NWF Payroll Certified Document System v2025"; 
    
    // *** THE CRITICAL FIX: Setting Creator and Producer ***
    pdfDoc.setCreator(customCreator);
    pdfDoc.setProducer(customCreator); 
    
    // Add other metadata for full compliance
    pdfDoc.setAuthor("NWF Payroll Services");
    pdfDoc.setTitle("Official Paystub Verification Document");
    
    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    
    // 💡 FIX 2: Convert the final data back to a Node.js Buffer explicitly
    return Buffer.from(pdfBytes); 
    
  } catch (error) {
    console.error("PDF Metadata Injection Failed:", error);
    // Throwing a precise error helps with server debugging
    throw new Error(`Could not inject metadata into PDF: ${error.message}`);
  }
}

module.exports = {
  generatePaystubPdf,
  injectMetadata
};
