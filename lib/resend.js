import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvoiceEmail(toEmail, subject, bodyText, pdfBuffer, filename = "invoice.pdf") {
  const email = await resend.emails.send({
    from: "webicxagency@gmail.com", // You can use any sender email
    to: toEmail,
    subject,
    text: bodyText,
    attachments: [
      {
        filename,
        type: "application/pdf",
        data: pdfBuffer.toString("base64")
      }
    ]
  });

  return email;
}
