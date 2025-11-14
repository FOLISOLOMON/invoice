const nodemailer = require('nodemailer');
const retry = require('async-retry');
const logger = require('../utils/logger');

// Initialize Paystack with error handling
let Paystack;
try {
  Paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);
} catch (error) {
  logger.error(`Failed to initialize Paystack: ${error.message}`);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const sendInvoiceEmail = async (clientEmail, invoiceData, pdfBuffer) => {
  // Initialize Paystack transaction
  const transactionData = {
    amount: invoiceData.total * 100,  // Paystack expects amount in kobo (for NGN) or cents
    email: clientEmail,
    reference: `INV-${invoiceData.invoiceNumber}-${Date.now()}`,  // Unique reference
    callback_url: `${process.env.BASE_URL}/api/paystack/payment-success`,  // Optional: Redirect after payment
  };

  let paymentUrl = '';
  try {
    if (!Paystack) {
      throw new Error('Paystack not initialized. Check PAYSTACK_SECRET_KEY environment variable.');
    }
    const response = await Paystack.transaction.initialize(transactionData);
    paymentUrl = response.data.authorization_url;  // The "Pay Now" link
    logger.info(`Paystack transaction initialized for ${invoiceData.invoiceNumber}: ${paymentUrl}`);
  } catch (error) {
    logger.error(`Paystack initialization failed: ${error.message}`);
    throw new Error('Failed to create payment link');
  }

  const emailBody = `
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333;">Your Company Name</h1>
        <p style="color: #777; font-size: 14px;">Professional Invoice</p>
      </div>
      
      <!-- Greeting -->
      <p>Hello <strong>${invoiceData.clientName}</strong>,</p>
      <p>Thank you for your order! Here are the details of your invoice:</p>
      
      <!-- Invoice Info -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoiceData.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoiceData.date}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoiceData.dueDate}</td>
        </tr>
      </table>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f0f0f0;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Item</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Qty</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Price</th>
        </tr>
        ${invoiceData.items.map(item => `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.description}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${item.quantity}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$${item.price}</td>
        </tr>`).join('')}
        <tr>
          <td colspan="2" style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>Total</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$${invoiceData.total}</strong></td>
        </tr>
      </table>

      <!-- Payment Button -->
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${paymentUrl}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay Now</a>
      </div>

      <!-- Footer -->
      <p style="font-size: 12px; color: #999; text-align: center;">
        If you have any questions, please contact us at <a href="mailto:support@yourcompany.com">support@yourcompany.com</a>.
      </p>
      <p style="font-size: 12px; color: #999; text-align: center;">&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
    </div>
  </body>
</html>
`;


  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: clientEmail,
    subject: `Invoice ${invoiceData.invoiceNumber}`,
    html: emailBody,
    attachments: [
      {
        filename: `invoice_${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  await retry(
    async () => {
      await transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${clientEmail} for ${invoiceData.invoiceNumber}`);
    },
    {
      retries: 3,
      onRetry: (error, attempt) => logger.warn(`Retry ${attempt}: ${error.message}`),
    }
  );
};

module.exports = { sendInvoiceEmail };