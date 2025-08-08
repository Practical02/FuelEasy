import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { 
  User, 
  Calendar, 
  FileText, 
  DollarSign, 
  Fuel,
  Receipt,
  Clock,
  CreditCard
} from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import type { SaleWithClient } from "@shared/schema";

interface ViewSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleWithClient | null;
}

export default function ViewSaleModal({ open, onOpenChange, sale }: ViewSaleModalProps) {
  const isMobile = useIsMobile();
  if (!sale) {
    return null;
  }

  const body = (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Sale Details - {sale.lpoNumber}</DialogTitle>
        <DialogDescription>
          Complete information about this fuel sale transaction
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
          {/* Sale Status */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Status</h3>
            <StatusBadge status={sale.saleStatus as any} />
          </div>

          {/* Client Information */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Client Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Company Name</p>
                  <p className="font-medium text-gray-900">{sale.client.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact Person</p>
                  <p className="font-medium text-gray-900">{sale.client.contactPerson}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone Number</p>
                  <p className="font-medium text-gray-900">{sale.client.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{sale.client.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sale Details */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Fuel className="w-5 h-5 mr-2" />
                Sale Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Sale Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(sale.saleDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">LPO Number</p>
                    <p className="font-medium text-gray-900">{sale.lpoNumber}</p>
                  </div>
                </div>
                {sale.lpoDueDate && (
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">LPO Due Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(sale.lpoDueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {sale.invoiceDate && (
                  <div className="flex items-center space-x-3">
                    <Receipt className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Invoice Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(sale.invoiceDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fuel & Pricing */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Fuel & Pricing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium text-lg">{parseFloat(sale.quantityGallons).toLocaleString()} gallons</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Unit Price:</span>
                    <span className="font-medium">{CURRENCY} {parseFloat(sale.salePricePerGallon).toFixed(3)}/gal</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">VAT Rate:</span>
                    <span className="font-medium">{parseFloat(sale.vatPercentage).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{CURRENCY} {parseFloat(sale.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">VAT Amount:</span>
                    <span className="font-medium">{CURRENCY} {parseFloat(sale.vatAmount).toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">Total Amount:</span>
                    <span className="font-bold text-xl text-primary-600">
                      {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">Sale Created</p>
                    <p className="text-sm text-gray-500">
                      {new Date(sale.createdAt).toLocaleDateString()} at {new Date(sale.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                
                {sale.saleStatus !== "Pending LPO" && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">LPO Received</p>
                      <p className="text-sm text-gray-500">LPO Number: {sale.lpoNumber}</p>
                    </div>
                  </div>
                )}

                {(sale.saleStatus === "Invoiced" || sale.saleStatus === "Paid") && sale.invoiceDate && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Invoice Generated</p>
                      <p className="text-sm text-gray-500">
                        {new Date(sale.invoiceDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {sale.saleStatus === "Paid" && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Payment Completed</p>
                      <p className="text-sm text-gray-500">Transaction completed</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
      </div>

      <div className="sticky bottom-0 bg-background pt-4 -mx-6 px-6 border-t border-gray-200 flex">
        <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto ml-auto">
          Close
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="p-6 max-h-[90vh] overflow-y-auto">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
}