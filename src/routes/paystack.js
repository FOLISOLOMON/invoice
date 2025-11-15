const express = require('express');
const crypto = require('crypto');  // For webhook verification
const logger = require('../utils/logger');
const router = express.Router();

// In-memory store for payment statuses (replace with DB if needed)
const paymentStatuses = {};  // e.g., { 'INV-123-123456': 'success' }

// Paystack webhook to update payment statuses
router.post('/webhook', (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  const signature = req.headers['x-paystack-signature'];

  if (hash !== signature) {
    logger.warn('Invalid Paystack webhook signature');
    return res.status(400).send('Invalid signature');
  }

  const event = req.body.event;
  const data = req.body.data;

  if (event === 'charge.success') {
    const reference = data.reference;
    paymentStatuses[reference] = 'success';
    logger.info(`Payment successful for reference: ${reference}`);
  } else if (event === 'charge.failed') {
    const reference = data.reference;
    paymentStatuses[reference] = 'failed';
    logger.info(`Payment failed for reference: ${reference}`);
  }

  res.status(200).send('Webhook received');
});

router.get('/payment-success', (req, res) => {
  const trxref = req.query.trxref || req.query.reference;

  if (!trxref) return res.status(400).send('Transaction reference missing');

  const status = paymentStatuses[trxref];

  if (status === 'success') {
    return res.redirect(`https://payments-xjxj.onrender.com/payment-success.html?trxref=${trxref}`);
  } else if (status === 'failed') {
    return res.redirect(`https://payments-xjxj.onrender.com/payment-failure.html`);
  } else {
    return res.send('Payment pending. Refresh in a few seconds.');
  }
});



// Endpoint for your app to check payment status programmatically
router.get('/payment-status/:reference', (req, res) => {
  const { reference } = req.params;
  const status = paymentStatuses[reference] || 'pending';
  res.json({ status });
});

module.exports = { router, paymentStatuses };
