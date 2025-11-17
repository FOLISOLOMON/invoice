const sgMail = require('@sendgrid/mail');
const path = require("path");
const retry = require('async-retry');
const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Initialize Paystack with error handling
let Paystack;
try {
  Paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);
} catch (error) {
  logger.error(`Failed to initialize Paystack: ${error.message}`);
}



// Date formatting function
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();

  const suffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${day}${suffix(day)} ${month}, ${year}`;
};

// Brand details
const BRANDS = {
  primegraphics: {
    name: "PrimeGraphics",
    logoPath: path.join(__dirname, "../../assets/prime.png"),
    email: "support@primegraphics.com",
    watermarkPath: path.join(__dirname, "../../assets/prime.png"),
  },
  webicx: {
    name: "Webicx",
    logoPath: path.join(__dirname, "../../assets/webix.png"),
    email: "support@webicx.com",
    watermarkPath: path.join(__dirname, "../../assets/webix.png"),
  },
};

// Generate PDF with embedded logo and watermark
const generateInvoicePDF = async (invoiceData, brandKey = "primegraphics") => {
  const brand = BRANDS[brandKey.toLowerCase()];
  if (!brand) throw new Error(`Unknown brand: ${brandKey}`);

  // Read logo and watermark as base64
  const logoBase64 = await fs.readFile(brand.logoPath, { encoding: 'base64' });
  const watermarkBase64 = await fs.readFile(brand.watermarkPath, { encoding: 'base64' });

  const logoDataUrl = `data:image/png;base64,${logoBase64}`;
  const watermarkDataUrl = `data:image/png;base64,${watermarkBase64}`;

  // HTML template for PDF with embedded images
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      padding: 40px;
      position: relative;
    }
    
    /* Watermark background */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.05;
      z-index: -1;
      width: 60%;
      height: auto;
    }
    
    /* Header with logo */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    
    .logo-section {
      flex: 1;
    }
    
    .logo {
      height: 60px;
      width: auto;
      display: block;
      margin-bottom: 10px;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    
    .invoice-title {
      text-align: right;
      flex: 1;
    }
    
    .invoice-title h1 {
      font-size: 36px;
      color: #333;
      margin-bottom: 5px;
    }
    
    .invoice-number {
      font-size: 14px;
      color: #666;
    }
    
    /* Client and invoice details */
    .details-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    
    .client-details, .invoice-details {
      flex: 1;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    
    .detail-row {
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .detail-label {
      font-weight: bold;
      color: #333;
    }
    
    /* Items table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table thead {
      background-color: #f0f0f0;
    }
    
    .items-table th {
      padding: 12px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #ddd;
      font-size: 14px;
    }
    
    .items-table th.right {
      text-align: right;
    }
    
    .items-table td {
      padding: 10px 12px;
      border: 1px solid #ddd;
      font-size: 14px;
    }
    
    .items-table td.right {
      text-align: right;
    }
    
    .items-table .total-row {
      background-color: #f9f9f9;
      font-weight: bold;
    }
    
    /* Footer */
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    
    .footer-contact {
      margin-bottom: 10px;
    }
    
    .footer-copyright {
      color: #999;
    }
  </style>
</head>
<body>
  <!-- Watermark -->
  <img src="${watermarkDataUrl}" class="watermark" alt="Watermark">
  
  <!-- Header -->
  <div class="header">
    <div class="logo-section">
      <img src="${logoDataUrl}" class="logo" alt="${brand.name} Logo">
      <div class="company-name">${brand.name}</div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-number">#${invoiceData.invoiceNumber}</div>
    </div>
  </div>
  
  <!-- Details Section -->
  <div class="details-section">
    <div class="client-details">
      <div class="section-title">Bill To</div>
      <div class="detail-row">
        <span class="detail-label">${invoiceData.clientName}</span>
      </div>
    </div>
    <div class="invoice-details">
      <div class="section-title">Invoice Details</div>
      <div class="detail-row">
        <span class="detail-label">Date:</span> ${formatDate(invoiceData.date)}
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span> ${formatDate(invoiceData.dueDate)}
      </div>
    </div>
  </div>
  
  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Quantity</th>
        <th class="right">Unit Price</th>
        <th class="right">Tax</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${invoiceData.items.map(item => {
        const amount = item.quantity * item.price + item.tax;
        return `
        <tr>
          <td>${item.description}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">GHS ${item.price.toFixed(2)}</td>
          <td class="right">GHS ${item.tax.toFixed(2)}</td>
          <td class="right">GHS ${amount.toFixed(2)}</td>
        </tr>`;
      }).join('')}
      <tr class="total-row">
        <td colspan="4" class="right">TOTAL</td>
        <td class="right">GHS ${invoiceData.total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  
  <!-- Footer -->
  <div class="footer">
    <div class="footer-contact">
      For questions, contact us at ${brand.email}
    </div>
    <div class="footer-copyright">
      © ${new Date().getFullYear()} ${brand.name}. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

const sendInvoiceEmail = async (clientEmail, invoiceData, brandKey = "primegraphics") => {
  const brand = BRANDS[brandKey.toLowerCase()];
  if (!brand) throw new Error(`Unknown brand: ${brandKey}`);

  // Generate PDF with embedded logo and watermark
  logger.info(`Generating PDF for invoice ${invoiceData.invoiceNumber}`);
  const pdfBuffer = await generateInvoicePDF(invoiceData, brandKey);

  // Initialize Paystack transaction
  const amount = Math.round(invoiceData.total * 100);
  const MAX_AMOUNT = 10000000; // 100,000 NGN maximum for online payment

  if (amount > MAX_AMOUNT) {
    throw new Error(`Invoice amount ($${invoiceData.total}) exceeds maximum allowed for online payment. Please reduce the amount or contact support for offline payment options.`);
  }

  const transactionData = {
    amount,
    email: clientEmail,
    reference: `INV-${invoiceData.invoiceNumber}-${Date.now()}`,
    callback_url: `${process.env.BASE_URL}/api/paystack/payment-success`,
  };

  let paymentUrl = '';
  try {
    if (!Paystack) throw new Error('Paystack not initialized');
    const response = await Paystack.transaction.initialize(transactionData);
    paymentUrl = response.data.authorization_url;
    logger.info(`Paystack transaction initialized for ${invoiceData.invoiceNumber}: ${paymentUrl}`);
  } catch (error) {
    logger.error(`Paystack initialization failed: ${error.message}`);
    throw new Error('Failed to create payment link');
  }

  // Build email HTML
  const emailBody = `
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <h1 style="color:#333; font-size:28px; margin-bottom:20px;">${brand.name}</h1>
      
      <!-- Greeting -->
      <p>Hello <strong>${invoiceData.clientName}</strong>,</p>
      <p>Thank you for your order! Please find your invoice attached.</p>
      
      <!-- Invoice Info -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoiceData.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(invoiceData.date)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(invoiceData.dueDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Amount:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>GHS ${invoiceData.total.toFixed(2)}</strong></td>
        </tr>
      </table>

      <!-- Payment Button -->
      <div style="text-align:center; margin:30px 0;">
        <a href="${paymentUrl}" style="background-color:#28a745; color:white; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block;">Pay Now</a>
      </div>

      <!-- Footer -->
      <p style="font-size:12px; color:#999; text-align:center;">
        If you have any questions, contact us at <a href="mailto:${brand.email}">${brand.email}</a>.
      </p>
      <p style="font-size:12px; color:#999; text-align:center;">&copy; ${new Date().getFullYear()} ${brand.name}. All rights reserved.</p>
    </div>
  </body>
</html>
`;

  const msg = {
    to: clientEmail,
    from: process.env.FROM_EMAIL,
    subject: `Invoice ${invoiceData.invoiceNumber} from ${brand.name}`,
    html: emailBody,
    attachments: [
      {
        content: Buffer.isBuffer(pdfBuffer) ? pdfBuffer.toString('base64') : Buffer.from(pdfBuffer).toString('base64'),
        filename: `invoice_${invoiceData.invoiceNumber}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  };

  await retry(
    async () => {
      await sgMail.send(msg);
      logger.info(`Invoice email sent to ${clientEmail} for ${invoiceData.invoiceNumber}`);
    },
    {
      retries: 3,
      onRetry: (error, attempt) => logger.warn(`Retry ${attempt}: ${error.message} - ${JSON.stringify(error.response?.body || error)}`),
    }
  );
};

module.exports = { sendInvoiceEmail, generateInvoicePDF };
