require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const invoiceRoutes = require('./routes/invoice');
const { router: paystackRoutes } = require('./routes/paystack');
const health = require('./routes/health');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use('/api', invoiceRoutes);
app.use('/api/paystack', paystackRoutes);
app.use('/api/health', health);

// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});