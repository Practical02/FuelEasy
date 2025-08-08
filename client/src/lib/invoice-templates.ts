import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InvoiceWithSale } from "@/pages/invoices";
import type { BusinessSettings } from "@shared/schema";
import { CURRENCY } from "./constants";

export interface InvoiceTemplateOptions {
  businessSettings: BusinessSettings;
  invoice: InvoiceWithSale;
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [25, 118, 210]; // Default blue
}

// Helper function to format currency
function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${CURRENCY} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper function to format date
function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Helper to add a logo if a data URL is provided
function tryAddLogo(doc: jsPDF, logoUrl?: string) {
  try {
    if (logoUrl && logoUrl.startsWith('data:')) {
      // Place logo in top-right; fit into a 28x28 box
      const imgWidth = 28;
      const imgHeight = 28;
      doc.addImage(logoUrl, 'PNG', 170, 6, imgWidth, imgHeight);
    }
  } catch {
    // Ignore logo errors silently
  }
}

// Modern Template
export function generateModernInvoice({ businessSettings, invoice }: InvoiceTemplateOptions): jsPDF {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(businessSettings.primaryColor);
  const secondaryColor = hexToRgb(businessSettings.secondaryColor);
  
  // Header with company branding
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');

  // Optional company logo (expects data URL in settings.logoUrl)
  tryAddLogo(doc, businessSettings.logoUrl);
  
  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(businessSettings.companyName, 20, 25);
  
  // Invoice title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('INVOICE', 160, 25);
  
  // Company details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let yPos = 50;
  
  if (businessSettings.companyAddress) {
    doc.text(businessSettings.companyAddress, 20, yPos);
    yPos += 4;
  }
  
  const cityStateZip = [businessSettings.companyCity, businessSettings.companyState, businessSettings.companyZip]
    .filter(Boolean).join(', ');
  if (cityStateZip) {
    doc.text(cityStateZip, 20, yPos);
    yPos += 4;
  }
  
  if (businessSettings.companyPhone) {
    doc.text(`Phone: ${businessSettings.companyPhone}`, 20, yPos);
    yPos += 4;
  }
  
  if (businessSettings.companyEmail) {
    doc.text(`Email: ${businessSettings.companyEmail}`, 20, yPos);
    yPos += 4;
  }
  if (businessSettings.companyWebsite) {
    doc.text(`Website: ${businessSettings.companyWebsite}`, 20, yPos);
    yPos += 4;
  }
  
  if (businessSettings.vatNumber) {
    doc.text(`VAT: ${businessSettings.vatNumber}`, 20, yPos);
    yPos += 4;
  }
  
  // Invoice details box
  doc.setFillColor(245, 245, 245);
  doc.rect(120, 45, 70, 35, 'F');
  doc.setDrawColor(...secondaryColor);
  doc.rect(120, 45, 70, 35, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Number:', 125, 52);
  doc.text('Invoice Date:', 125, 58);
  doc.text('Due Date:', 125, 64);
  doc.text('LPO Number:', 125, 70);
  
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoiceNumber, 155, 52);
  doc.text(formatDate(invoice.invoiceDate), 155, 58);
  
  // Calculate due date based on payment terms
  const dueDate = new Date(invoice.invoiceDate);
  const terms = businessSettings.defaultPaymentTerms.match(/\d+/);
  if (terms) {
    dueDate.setDate(dueDate.getDate() + parseInt(terms[0]));
  }
  doc.text(formatDate(dueDate), 155, 64);
  doc.text(invoice.sale.lpoNumber || 'N/A', 155, 70);
  
  // Bill To section
  yPos = 90;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('BILL TO:', 20, yPos);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.sale.client.name, 20, yPos + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(invoice.sale.client.address, 20, yPos + 15);
  doc.text(`Contact: ${invoice.sale.client.contactPerson}`, 20, yPos + 22);
  doc.text(`Phone: ${invoice.sale.client.phoneNumber}`, 20, yPos + 29);
  doc.text(`Email: ${invoice.sale.client.email}`, 20, yPos + 36);
  
  // Items table
  const itemsStartY = yPos + 50;
  
  // Calculate amounts
  const subtotal = parseFloat(invoice.totalAmount) - parseFloat(invoice.vatAmount);
  const vatAmount = parseFloat(invoice.vatAmount);
  const total = parseFloat(invoice.totalAmount);
  const paidAmount = total - parseFloat(invoice.sale.pendingAmount || "0");
  const pendingAmount = parseFloat(invoice.sale.pendingAmount || "0");
  
  autoTable(doc, {
    startY: itemsStartY,
    head: [['Description', 'Quantity', 'Unit Price', 'Amount']],
    body: [
      [
        `Fuel Supply - ${invoice.sale.project?.name || 'General'}`,
        `${parseFloat(invoice.sale.quantityGallons).toLocaleString()} gallons`,
        formatCurrency(invoice.sale.salePricePerGallon),
        formatCurrency(subtotal)
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    }
  });
  
  // Summary table
  const summaryStartY = (doc as any).lastAutoTable.finalY + 10;
  
  autoTable(doc, {
    startY: summaryStartY,
    body: [
      ['Subtotal', formatCurrency(subtotal)],
      [`VAT (${invoice.sale.vatPercentage}%)`, formatCurrency(vatAmount)],
      ['Total Amount', formatCurrency(total)],
      ['Paid Amount', formatCurrency(paidAmount)],
      ['Balance Due', formatCurrency(pendingAmount)]
    ],
    theme: 'plain',
    bodyStyles: {
      fontSize: 10
    },
    columnStyles: {
      0: { cellWidth: 140, halign: 'right', fontStyle: 'normal' },
      1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function(data) {
      if (data.row.index === 2 || data.row.index === 4) { // Total and Balance Due
        data.cell.styles.fillColor = data.row.index === 4 && pendingAmount > 0 
          ? [255, 240, 240] : [240, 248, 255];
        data.cell.styles.textColor = data.row.index === 4 && pendingAmount > 0 
          ? [200, 0, 0] : primaryColor;
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
  
  // Payment terms and footer
  const footerStartY = (doc as any).lastAutoTable.finalY + 20;
  
  if (businessSettings.defaultPaymentTerms) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Terms:', 20, footerStartY);
    doc.setFont('helvetica', 'normal');
    doc.text(businessSettings.defaultPaymentTerms, 20, footerStartY + 6);
  }
  
  if (businessSettings.bankName) {
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Details:', 20, footerStartY + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bank: ${businessSettings.bankName}`, 20, footerStartY + 21);
    if (businessSettings.bankAccount) {
      doc.text(`Account: ${businessSettings.bankAccount}`, 20, footerStartY + 27);
    }
  }
  
  // Footer
  if (businessSettings.invoiceFooter) {
    doc.setFillColor(...primaryColor);
    doc.rect(0, 270, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(businessSettings.invoiceFooter, 105, 282, { align: 'center' });
  }
  
  return doc;
}

// Classic Template
export function generateClassicInvoice({ businessSettings, invoice }: InvoiceTemplateOptions): jsPDF {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(businessSettings.primaryColor);
  
  // Header border
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(2);
  doc.line(20, 20, 190, 20);
  
  // Company name and invoice title
  doc.setFontSize(20);
  doc.setFont('times', 'bold');
  doc.text(businessSettings.companyName, 20, 35);
  
  doc.setFontSize(16);
  doc.text('INVOICE', 160, 35);
  
  // Company details in a simple format
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  let yPos = 45;
  
  const companyInfo = [
    businessSettings.companyAddress,
    [businessSettings.companyCity, businessSettings.companyState, businessSettings.companyZip].filter(Boolean).join(', '),
    businessSettings.companyPhone && `Phone: ${businessSettings.companyPhone}`,
    businessSettings.companyEmail && `Email: ${businessSettings.companyEmail}`,
    businessSettings.vatNumber && `VAT: ${businessSettings.vatNumber}`
  ].filter(Boolean);
  
  companyInfo.forEach(info => {
    doc.text(info as string, 20, yPos);
    yPos += 5;
  });
  
  // Invoice details table
  autoTable(doc, {
    startY: 75,
    body: [
      ['Invoice Number:', invoice.invoiceNumber],
      ['Invoice Date:', formatDate(invoice.invoiceDate)],
      ['Payment Terms:', businessSettings.defaultPaymentTerms],
      ['LPO Number:', invoice.sale.lpoNumber || 'N/A']
    ],
    theme: 'grid',
    styles: {
      fontSize: 10,
      font: 'times'
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 50 }
    }
  });
  
  // Client details
  const clientStartY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('Bill To:', 20, clientStartY);
  
  autoTable(doc, {
    startY: clientStartY + 5,
    body: [
      ['Company:', invoice.sale.client.name],
      ['Address:', invoice.sale.client.address],
      ['Contact:', invoice.sale.client.contactPerson],
      ['Phone:', invoice.sale.client.phoneNumber],
      ['Email:', invoice.sale.client.email]
    ],
    theme: 'plain',
    styles: {
      fontSize: 10,
      font: 'times'
    },
    columnStyles: {
      0: { cellWidth: 25, fontStyle: 'bold' },
      1: { cellWidth: 100 }
    }
  });
  
  // Items and totals
  const itemsStartY = (doc as any).lastAutoTable.finalY + 15;
  
  const subtotal = parseFloat(invoice.totalAmount) - parseFloat(invoice.vatAmount);
  const vatAmount = parseFloat(invoice.vatAmount);
  const total = parseFloat(invoice.totalAmount);
  const pendingAmount = parseFloat(invoice.sale.pendingAmount || "0");
  
  autoTable(doc, {
    startY: itemsStartY,
    head: [['Description', 'Quantity', 'Rate', 'Amount']],
    body: [
      [
        `Fuel Supply - ${invoice.sale.project?.name || 'General'}`,
        `${parseFloat(invoice.sale.quantityGallons).toLocaleString()} gallons`,
        formatCurrency(invoice.sale.salePricePerGallon),
        formatCurrency(subtotal)
      ],
      ['', '', 'Subtotal:', formatCurrency(subtotal)],
      ['', '', `VAT (${invoice.sale.vatPercentage}%):`, formatCurrency(vatAmount)],
      ['', '', 'Total Amount:', formatCurrency(total)],
      ['', '', 'Balance Due:', formatCurrency(pendingAmount)]
    ],
    theme: 'grid',
    styles: {
      fontSize: 10,
      font: 'times'
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold'
    },
    didParseCell: function(data) {
      if (data.row.index >= 1 && data.column.index <= 1) {
        data.cell.text = [];
      }
      if (data.row.index >= 1) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.row.index === 4) { // Balance Due
        data.cell.styles.textColor = pendingAmount > 0 ? [200, 0, 0] : [0, 150, 0];
      }
    }
  });
  
  // Footer
  const footerY = (doc as any).lastAutoTable.finalY + 20;
  if (businessSettings.invoiceFooter) {
    doc.setDrawColor(...primaryColor);
    doc.line(20, footerY, 190, footerY);
    doc.setFontSize(10);
    doc.setFont('times', 'italic');
    doc.text(businessSettings.invoiceFooter, 105, footerY + 10, { align: 'center' });
  }
  
  return doc;
}

// Minimal Template
export function generateMinimalInvoice({ businessSettings, invoice }: InvoiceTemplateOptions): jsPDF {
  const doc = new jsPDF();
  
  // Simple header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice', 20, 30);
  
  // Company and invoice info side by side
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Company info (left)
  let yPos = 45;
  doc.text(businessSettings.companyName, 20, yPos);
  yPos += 5;
  
  if (businessSettings.companyAddress) {
    doc.text(businessSettings.companyAddress, 20, yPos);
    yPos += 4;
  }
  
  const cityState = [businessSettings.companyCity, businessSettings.companyState].filter(Boolean).join(', ');
  if (cityState) {
    doc.text(cityState, 20, yPos);
    yPos += 4;
  }
  
  if (businessSettings.companyEmail) {
    doc.text(businessSettings.companyEmail, 20, yPos);
  }
  
  // Invoice info (right)
  doc.text(`Invoice: ${invoice.invoiceNumber}`, 130, 45);
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`, 130, 50);
  doc.text(`LPO: ${invoice.sale.lpoNumber || 'N/A'}`, 130, 55);
  
  // Bill to
  yPos = 75;
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.sale.client.name, 20, yPos + 6);
  doc.text(invoice.sale.client.address, 20, yPos + 12);
  doc.text(invoice.sale.client.contactPerson, 20, yPos + 18);
  
  // Simple line items
  const itemsY = yPos + 35;
  doc.line(20, itemsY, 190, itemsY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 20, itemsY + 8);
  doc.text('Qty', 120, itemsY + 8);
  doc.text('Rate', 140, itemsY + 8);
  doc.text('Amount', 170, itemsY + 8);
  
  doc.line(20, itemsY + 12, 190, itemsY + 12);
  
  doc.setFont('helvetica', 'normal');
  const subtotal = parseFloat(invoice.totalAmount) - parseFloat(invoice.vatAmount);
  
  doc.text(`Fuel Supply - ${invoice.sale.project?.name || 'General'}`, 20, itemsY + 20);
  doc.text(`${parseFloat(invoice.sale.quantityGallons).toLocaleString()}`, 120, itemsY + 20);
  doc.text(formatCurrency(invoice.sale.salePricePerGallon), 140, itemsY + 20);
  doc.text(formatCurrency(subtotal), 170, itemsY + 20);
  
  // Totals
  const totalsY = itemsY + 35;
  doc.line(130, totalsY, 190, totalsY);
  
  doc.text('Subtotal:', 140, totalsY + 8);
  doc.text(formatCurrency(subtotal), 170, totalsY + 8);
  
  doc.text(`VAT (${invoice.sale.vatPercentage}%):`, 140, totalsY + 14);
  doc.text(formatCurrency(invoice.vatAmount), 170, totalsY + 14);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 140, totalsY + 22);
  doc.text(formatCurrency(invoice.totalAmount), 170, totalsY + 22);
  
  const pendingAmount = parseFloat(invoice.sale.pendingAmount || "0");
  if (pendingAmount > 0) {
    doc.setTextColor(200, 0, 0);
    doc.text('Balance Due:', 140, totalsY + 30);
    doc.text(formatCurrency(pendingAmount), 170, totalsY + 30);
  }
  
  // Simple footer
  if (businessSettings.invoiceFooter) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(businessSettings.invoiceFooter, 105, 250, { align: 'center' });
  }
  
  return doc;
}

// Main function to generate invoice based on template
export function generateProfessionalInvoice(
  invoice: InvoiceWithSale, 
  businessSettings: BusinessSettings
): void {
  let doc: jsPDF;
  
  const options = { businessSettings, invoice };
  
  switch (businessSettings.templateStyle) {
    case 'classic':
      doc = generateClassicInvoice(options);
      break;
    case 'minimal':
      doc = generateMinimalInvoice(options);
      break;
    case 'modern':
    default:
      doc = generateModernInvoice(options);
      break;
  }
  
  // Save the PDF
  doc.save(`${businessSettings.invoicePrefix}-${invoice.invoiceNumber}.pdf`);
}