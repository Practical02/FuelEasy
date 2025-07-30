export const SALE_STATUSES = [
  "Pending LPO",
  "LPO Received", 
  "Invoiced",
  "Paid"
] as const;

export const PAYMENT_METHODS = [
  "Cheque",
  "Bank Transfer",
  "Cash"
] as const;

export const VAT_PERCENTAGE = 5; // UAE VAT rate

export const STATUS_COLORS = {
  "Pending LPO": "bg-warning-100 text-warning-600",
  "LPO Received": "bg-blue-100 text-blue-600", 
  "Invoiced": "bg-primary-100 text-primary-600",
  "Paid": "bg-success-100 text-success-600"
} as const;

export const CURRENCY = "AED";

export const LOW_STOCK_THRESHOLD = 5000; // gallons
