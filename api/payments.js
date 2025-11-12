import { initializePayment, verifyPayment } from "../lib/paystack.js";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const { email, amount } = req.body;
      if (!email || !amount) return res.status(400).json({ error: "Email and amount required" });
      const payment = await initializePayment(email, amount);
      return res.status(200).json(payment);
    }

    if (req.method === "GET") {
      const { reference } = req.query;
      if (!reference) return res.status(400).json({ error: "Reference required" });
      const verification = await verifyPayment(reference);
      return res.status(200).json(verification);
    }

    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "Method Not Allowed" });

  } catch (err) {
    return res.status(500).json({ error: "Server Error", details: err.message });
  }
}
