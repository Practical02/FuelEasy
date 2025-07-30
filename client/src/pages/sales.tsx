import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import NewSaleModal from "@/components/modals/new-sale-modal";
import PaymentModal from "@/components/modals/payment-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Eye, CreditCard } from "lucide-react";
import { CURRENCY, SALE_STATUSES } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SaleWithClient } from "@shared/schema";

export default function Sales() {
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: sales, isLoading } = useQuery<SaleWithClient[]>({
    queryKey: ["/api/sales", statusFilter !== "all" ? statusFilter : undefined].filter(Boolean),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ saleId, status }: { saleId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/sales/${saleId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      toast({
        title: "Status Updated",
        description: "Sale status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sale status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (saleId: string, newStatus: string) => {
    updateStatusMutation.mutate({ saleId, status: newStatus });
  };

  const handlePaymentClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowPaymentModal(true);
  };

  const filteredSales = sales?.filter(sale => 
    statusFilter === "all" || sale.saleStatus === statusFilter
  ) || [];

  return (
    <>
      <Header 
        title="Sales Management"
        description="Track and manage diesel fuel sales transactions"
        primaryAction={{
          label: "New Sale",
          onClick: () => setShowNewSaleModal(true)
        }}
      />

      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <h3 className="text-lg font-semibold text-gray-900">All Sales</h3>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {SALE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => setShowNewSaleModal(true)} 
                className="bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto"
              >
                New Sale
              </Button>
            </div>

            {/* Desktop Table - Hidden on Mobile */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Sale Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Unit Price</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Total Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Due Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        Loading sales...
                      </td>
                    </tr>
                  ) : filteredSales.length > 0 ? (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(sale.saleDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{sale.client.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {parseFloat(sale.quantityGallons).toLocaleString()} gal
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {CURRENCY} {parseFloat(sale.salePricePerGallon).toFixed(3)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{sale.lpoNumber}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(sale.lpoDueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <Select
                            value={sale.saleStatus}
                            onValueChange={(value) => handleStatusChange(sale.id, value)}
                            disabled={updateStatusMutation.isPending}
                          >
                            <SelectTrigger className="w-32">
                              <StatusBadge status={sale.saleStatus as any} />
                            </SelectTrigger>
                            <SelectContent>
                              {SALE_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-primary-600 hover:text-primary-800"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-gray-600 hover:text-gray-800"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {sale.saleStatus !== "Paid" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePaymentClick(sale.id)}
                                className="text-success-600 hover:text-success-800"
                              >
                                <CreditCard className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        {statusFilter === "all" 
                          ? "No sales recorded yet. Click 'New Sale' to get started."
                          : `No sales found with status "${statusFilter}".`
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout - Visible on Mobile */}
            <div className="lg:hidden space-y-4">
              {isLoading ? (
                <div className="py-8 text-center text-gray-500">
                  Loading sales...
                </div>
              ) : filteredSales.length > 0 ? (
                filteredSales.map((sale) => (
                  <Card key={sale.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{sale.client.name}</h4>
                          <p className="text-sm text-gray-500">
                            {new Date(sale.saleDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          <StatusBadge status={sale.saleStatus as any} />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <div>
                          <span className="text-gray-500">Quantity:</span>
                          <span className="ml-1 font-medium">{parseFloat(sale.quantityGallons).toLocaleString()} gal</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Unit Price:</span>
                          <span className="ml-1 font-medium">{CURRENCY} {parseFloat(sale.salePricePerGallon).toFixed(3)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Total:</span>
                          <span className="ml-1 font-medium text-lg">{CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">LPO:</span>
                          <span className="ml-1 font-medium">{sale.lpoNumber}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Select
                          value={sale.saleStatus}
                          onValueChange={(value) => handleStatusChange(sale.id, value)}
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SALE_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {sale.saleStatus !== "Paid" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePaymentClick(sale.id)}
                              className="flex-1 sm:flex-none bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Pay
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500">
                  {statusFilter === "all" 
                    ? "No sales recorded yet. Click 'New Sale' to get started."
                    : `No sales found with status "${statusFilter}".`
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <NewSaleModal 
        open={showNewSaleModal} 
        onOpenChange={setShowNewSaleModal} 
      />
      <PaymentModal 
        open={showPaymentModal} 
        onOpenChange={setShowPaymentModal}
        saleId={selectedSaleId}
      />
    </>
  );
}
