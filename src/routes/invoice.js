const express = require('express');
const Joi = require('joi');
const { sendInvoiceEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

const schema = Joi.object({
  clientEmail: Joi.string().email().required(),

  invoiceData: Joi.object({
    clientName: Joi.string().required(),
    invoiceNumber: Joi.string().required(),
    date: Joi.string().required(),
    dueDate: Joi.string().required(),

    items: Joi.array().items(
      Joi.object({
        id: Joi.number().required(),             // allow id
        description: Joi.string().required(),    // fix description
        quantity: Joi.number().min(1).required(),
        price: Joi.number().min(0).required(),
        tax: Joi.number().min(0).required(),     // allow tax
      })
    ).required(),

    total: Joi.number().min(0).required(),
  }).required(),

  pdfBase64: Joi.string().required(),
});


router.post('/send-invoice', async (req, res) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn(`Validation error: ${error.details[0].message}`);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { clientEmail, invoiceData, pdfBase64 } = value;
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    await sendInvoiceEmail(clientEmail, invoiceData, pdfBuffer);
    res.status(200).json({ status: 'success' });
  } catch (err) {
    logger.error(`Error: ${err.message}`);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;

