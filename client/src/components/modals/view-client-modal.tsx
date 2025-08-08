import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MapPin, Receipt, TrendingUp, Calendar } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import type { Client, SaleWithClient } from "@shared/schema";

interface ViewClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export default function ViewClientModal({ open, onOpenChange, client }: ViewClientModalProps) {
  const isMobile = useIsMobile();
  const { data: salesResponse } = useQuery<any>({
    queryKey: ["/api/sales"],
    enabled: !!client,
  });
  const sales: SaleWithClient[] = Array.isArray(salesResponse)
    ? (salesResponse as SaleWithClient[])
    : (salesResponse?.data ?? []);

  if (!client) return null;

  // Calculate client statistics
  const clientSales = sales?.filter(sale => sale.clientId === client.id) || [];
  const totalSales = clientSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  const totalQuantity = clientSales.reduce((sum, sale) => sum + parseFloat(sale.quantityGallons), 0);
  const pendingSales = clientSales.filter(sale => sale.saleStatus !== "Paid");
  const pendingAmount = pendingSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);

  const body = (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{client.name}</DialogTitle>
        <DialogDescription>
          Complete client profile and transaction history
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
          {/* Client Information */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Phone Number</p>
                      <p className="font-medium">{client.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{client.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Receipt className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Contact Person</p>
                      <p className="font-medium">{client.contactPerson}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Client Since</p>
                      <p className="font-medium">{new Date(client.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">{client.address}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Sales</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {CURRENCY} {totalSales.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalQuantity.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">gallons</p>
                  </div>
                  <Receipt className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {CURRENCY} {pendingAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">{pendingSales.length} transactions</p>
                  </div>
                  <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-orange-600">!</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
              {clientSales.length > 0 ? (
                <div className="space-y-3">
                  {clientSales.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{sale.lpoNumber}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(sale.saleDate).toLocaleDateString()} • {parseFloat(sale.quantityGallons).toLocaleString()} gallons
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </p>
                        <Badge 
                          className={
                            sale.saleStatus === "Paid" ? "bg-green-100 text-green-600" :
                            sale.saleStatus === "Invoiced" ? "bg-blue-100 text-blue-600" :
                            sale.saleStatus === "LPO Received" ? "bg-yellow-100 text-yellow-600" :
                            "bg-gray-100 text-gray-600"
                          }
                        >
                          {sale.saleStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {clientSales.length > 5 && (
                    <p className="text-sm text-gray-500 text-center pt-3">
                      ... and {clientSales.length - 5} more transactions
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No transactions found for this client</p>
                </div>
              )}
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
}