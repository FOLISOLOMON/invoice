import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function generateInvoicePDF({ customerName, email, amount, reference }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText("Invoice", { x: 50, y: 350, size: 30, font, color: rgb(0, 0, 0) });
  page.drawText(`Customer: ${customerName}`, { x: 50, y: 300, size: 16, font });
  page.drawText(`Email: ${email}`, { x: 50, y: 270, size: 16, font });
  page.drawText(`Amount: ${amount}`, { x: 50, y: 240, size: 16, font });
  page.drawText(`Reference: ${reference}`, { x: 50, y: 210, size: 16, font });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
