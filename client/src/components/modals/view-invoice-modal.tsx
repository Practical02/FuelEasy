import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, User, Calendar, Hash, DollarSign, Percent } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import type { Invoice, SaleWithClient } from "@shared/schema";

type InvoiceWithSale = Invoice & {
  sale: SaleWithClient;
};

interface ViewInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceWithSale | null;
}

export default function ViewInvoiceModal({ open, onOpenChange, invoice }: ViewInvoiceModalProps) {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Invoice Details</DialogTitle>
          <DialogDescription>
            Viewing invoice {invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Invoice Number</p>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Invoice Date</p>
                  <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="font-medium">{invoice.sale.client.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Hash className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">LPO Number</p>
                  <p className="font-medium">{invoice.sale.lpoNumber}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Amount Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{CURRENCY} {(parseFloat(invoice.totalAmount) - parseFloat(invoice.vatAmount)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT ({invoice.sale.vatPercentage}%)</span>
                  <span className="font-medium">{CURRENCY} {parseFloat(invoice.vatAmount).toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg">
                  <span>Total Amount</span>
                  <span>{CURRENCY} {parseFloat(invoice.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Pending Amount</span>
                  <span className="font-medium">{CURRENCY} {parseFloat(invoice.sale.pendingAmount || "0").toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Badge
              className={
                invoice.status === "Paid" ? "bg-green-100 text-green-600" :
                invoice.status === "Sent" ? "bg-blue-100 text-blue-600" :
                "bg-gray-100 text-gray-600"
              }
            >
              Status: {invoice.status}
            </Badge>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
