import type { InvoiceWithSale } from "@/pages/invoices";
import type { BusinessSettings } from "@shared/schema";
import { generateProfessionalInvoice } from "./invoice-templates";

// Default business settings for fallback
const defaultBusinessSettings: BusinessSettings = {
  id: '',
  companyName: 'FuelFlow Trading',
  companyAddress: '',
  companyCity: '',
  companyState: '',
  companyZip: '',
  companyCountry: '',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  taxNumber: '',
  vatNumber: '',
  invoicePrefix: 'INV',
  invoiceNumberStart: 1000,
  primaryColor: '#1976D2',
  secondaryColor: '#666666',
  logoUrl: '',
  defaultPaymentTerms: 'Net 30',
  bankName: '',
  bankAccount: '',
  bankRoutingNumber: '',
  invoiceFooter: 'Thank you for your business!',
  templateStyle: 'modern',
  createdAt: new Date(),
  updatedAt: new Date()
};

// Legacy function for backward compatibility
export function generateInvoicePDF(invoice: InvoiceWithSale, businessSettings?: BusinessSettings) {
  const settings = businessSettings || defaultBusinessSettings;
  generateProfessionalInvoice(invoice, settings);
}

// New function that fetches business settings
export async function generateInvoicePDFWithSettings(invoice: InvoiceWithSale) {
  try {
    const response = await fetch('/api/business-settings', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const businessSettings: BusinessSettings = await response.json();
      generateProfessionalInvoice(invoice, businessSettings);
    } else {
      // Fallback to default settings
      generateProfessionalInvoice(invoice, defaultBusinessSettings);
    }
  } catch (error) {
    console.error('Failed to fetch business settings, using defaults:', error);
    generateProfessionalInvoice(invoice, defaultBusinessSettings);
  }
}
