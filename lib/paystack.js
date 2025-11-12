import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function initializePayment(email, amount) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      amount: amount * 100, // Paystack expects kobo
      callback_url: "https://invoice-gyz5.onrender.com/api/payments/verify"
    })
  });
  return response.json();
}

export async function verifyPayment(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
  });
  return response.json();
}
