const express = require('express');
const Joi = require('joi');
const { sendInvoiceEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

// Updated schema - no more pdfBase64 needed!
const schema = Joi.object({
  clientEmail: Joi.string().email().required(),

  invoiceData: Joi.object({
    clientName: Joi.string().required(),
    invoiceNumber: Joi.string().required(),
    date: Joi.string().required(),
    dueDate: Joi.string().required(),

    items: Joi.array().items(
      Joi.object({
        id: Joi.number().required(),
        description: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        price: Joi.number().min(0).required(),
        tax: Joi.number().min(0).required(),
      })
    ).required(),

    total: Joi.number().min(0).required(),
  }).unknown(true).required(),

  // Optional brand selection
  brandKey: Joi.string().valid('primegraphics', 'webicx').default('primegraphics'),
}).unknown(true);

router.post('/send-invoice', async (req, res) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn(`Validation error: ${error.details[0].message}`);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { clientEmail, invoiceData, brandKey } = value;

    // Backend now generates the PDF with embedded logo and watermark
    await sendInvoiceEmail(clientEmail, invoiceData, brandKey);
    
    res.status(200).json({ 
      status: 'success',
      message: 'Invoice email sent successfully' 
    });
  } catch (err) {
    logger.error(`Error sending invoice: ${err.message}`);
    res.status(500).json({ error: 'Failed to send invoice email' });
  }
});

module.exports = router;