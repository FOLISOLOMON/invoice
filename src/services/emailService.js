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
    callback_url: `${process.env.BASE_URL}/api/payment-success`,  // Optional: Redirect after payment
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
      <body>
        <p>Hello ${invoiceData.clientName},</p>
        <p>Thank you for your order. Here are your invoice details:</p>
        <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
        <p><strong>Date:</strong> ${invoiceData.date}</p>
        <ul>
          ${invoiceData.items.map(item => `<li>${item.name} – Qty: ${item.quantity} – $${item.price}</li>`).join('')}
        </ul>
        <p><strong>Total:</strong> $${invoiceData.total}</p>
        <p><a href="${paymentUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a></p>
        <p>Best regards,<br>Your Company</p>
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