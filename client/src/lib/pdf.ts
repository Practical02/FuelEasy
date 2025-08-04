import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InvoiceWithSale } from "@/pages/invoices";
import { CURRENCY } from "./constants";

export function generateInvoicePDF(invoice: InvoiceWithSale) {
  const doc = new jsPDF();

  // Add header
  doc.setFontSize(20);
  doc.text("Invoice", 14, 22);

  // Add invoice details
  autoTable(doc, {
    startY: 30,
    head: [["Invoice Number", "Invoice Date", "LPO Number"]],
    body: [
      [
        invoice.invoiceNumber,
        new Date(invoice.invoiceDate).toLocaleDateString(),
        invoice.sale.lpoNumber,
      ],
    ],
  });

  // Add client details
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Client Name", "Client Address", "Client Contact"]],
    body: [
      [
        invoice.sale.client.name,
        invoice.sale.client.address,
        invoice.sale.client.contactPerson,
      ],
    ],
  });

  // Add amount details
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Description", "Amount"]],
    body: [
      [
        "Subtotal",
        `${CURRENCY} ${(
          parseFloat(invoice.totalAmount) - parseFloat(invoice.vatAmount)
        ).toLocaleString()}`,
      ],
      [
        `VAT (${invoice.sale.vatPercentage}%)`,
        `${CURRENCY} ${parseFloat(invoice.vatAmount).toLocaleString()}`,
      ],
    ],
  });

  // Add total
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY,
    body: [
      [
        {
          content: "Total Amount",
          styles: { fontStyle: "bold" },
        },
        {
          content: `${CURRENCY} ${parseFloat(
            invoice.totalAmount
          ).toLocaleString()}`,
          styles: { fontStyle: "bold" },
        },
      ],
      [
        {
          content: "Pending Amount",
          styles: { fontStyle: "bold", textColor: [255, 0, 0] },
        },
        {
          content: `${CURRENCY} ${parseFloat(
            invoice.sale.pendingAmount || "0"
          ).toLocaleString()}`,
          styles: { fontStyle: "bold", textColor: [255, 0, 0] },
        },
      ],
    ],
  });

  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
}
