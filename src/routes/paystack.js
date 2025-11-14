const express = require('express');
const crypto = require('crypto');  // For webhook verification
const logger = require('../utils/logger');

const router = express.Router();

// In-memory store for payment statuses (replace with DB if needed)
const paymentStatuses = {};  // e.g., { 'INV-123-123456': 'success' }

router.post('/webhook', (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
  const signature = req.headers['x-paystack-signature'];

  if (hash !== signature) {
    logger.warn('Invalid Paystack webhook signature');
    return res.status(400).send('Invalid signature');
  }

  const event = req.body.event;
  const data = req.body.data;

  if (event === 'charge.success') {
    const reference = data.reference;
    paymentStatuses[reference] = 'success';  // Store status
    logger.info(`Payment successful for reference: ${reference}`);
    // TODO: Notify the app (see below)
  } else if (event === 'charge.failed') {
    const reference = data.reference;
    paymentStatuses[reference] = 'failed';
    logger.info(`Payment failed for reference: ${reference}`);
  }

  res.status(200).send('Webhook received');
});

// New endpoint for the app to check payment status
router.get('/payment-status/:reference', (req, res) => {
  const { reference } = req.params;
  const status = paymentStatuses[reference] || 'pending';
  res.json({ status });
});

module.exports = { router, paymentStatuses };