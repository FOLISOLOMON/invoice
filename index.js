import express from "express";
import cors from "cors";
import helmet from "helmet";

// Import route handlers
import invoiceHandler from "./api/invoice.js";
import paymentHandler from "./api/payments.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Routes
app.post("/api/invoice", invoiceHandler);
app.post("/api/payment", paymentHandler);
app.get("/api/payment", paymentHandler); // handles GET for payment verification

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
