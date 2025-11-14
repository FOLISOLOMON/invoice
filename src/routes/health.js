const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ status: "ok", message: "Invoice backend is live!" });
});

module.exports = router;
