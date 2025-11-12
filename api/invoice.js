import { generateInvoicePDF } from "../lib/pdf.js";
import { sendInvoiceEmail } from "../lib/resend.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { customerName, email, amount, reference } = req.body;
    if (!customerName || !email || !amount || !reference) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // 1️⃣ Generate PDF
    const pdfBuffer = await generateInvoicePDF({ customerName, email, amount, reference });

    if (!pdfBuffer) {
      return res.status(500).json({ error: "Failed to generate PDF" });
    }

    // 2️⃣ Send via Resend (using base64 content)
    const emailResult = await sendInvoiceEmail(
      email,
      "Your Invoice",
      `Hello ${customerName},\n\nPlease find your invoice attached.`,
      {
        content: pdfBuffer.toString("base64"),
        filename: `${reference}.pdf`,
        type: "application/pdf"
      }
    );

    return res.status(200).json({ message: "Invoice sent successfully!", emailResult });
  } catch (err) {
    return res.status(500).json({ error: "Server Error", details: err.message });
  }
}
