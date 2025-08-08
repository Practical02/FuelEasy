import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import NewSaleModal from "@/components/modals/new-sale-modal";
import NewStockModal from "@/components/modals/new-stock-modal";
import NewClientModal from "@/components/modals/new-client-modal";
import PaymentModal from "@/components/modals/payment-modal";
import ViewSaleModal from "@/components/modals/view-sale-modal";
import { Button } from "@/components/ui/button";
import { 
  Fuel, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Plus,
  Users,
  Receipt,
  CreditCard,
  AlertTriangle,
  Eye,
  Edit
} from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import type { SaleWithClient } from "@shared/schema";

export default function Dashboard() {
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showNewStockModal, setShowNewStockModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showViewSaleModal, setShowViewSaleModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [, setLocation] = useLocation();

  const { data: overdue } = useQuery<{ days: number; data: any[] }>({
    queryKey: ["/api/notifications/overdue-clients?days=30"],
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<{
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    currentStock: number;
    pendingLPOCount: number;
    pendingLPOValue: number;
    grossMargin: number;
  }>({
    queryKey: ["/api/reports/overview"],
  });

  const { data: recentSalesResponse, isLoading: salesLoading } = useQuery<any>({
    queryKey: ["/api/sales"],
  });
  const recentSales: SaleWithClient[] = Array.isArray(recentSalesResponse)
    ? (recentSalesResponse as SaleWithClient[])
    : (recentSalesResponse?.data ?? []);

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  const quickActions = [
    {
      label: "Add Stock",
      icon: Plus,
      onClick: () => setShowNewStockModal(true),
      color: "primary-500"
    },
    {
      label: "New Client", 
      icon: Users,
      onClick: () => setShowNewClientModal(true),
      color: "primary-500"
    },
    {
      label: "Record Sale",
      icon: Receipt,
      onClick: () => setShowNewSaleModal(true),
      color: "primary-500"
    },
    {
      label: "Add Payment",
      icon: CreditCard,
      onClick: () => setShowPaymentModal(true),
      color: "primary-500"
    }
  ];

  const handlePaymentClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowPaymentModal(true);
  };

  const handleViewClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowViewSaleModal(true);
  };

  const handleNavigateToSales = () => {
    setLocation("/sales");
  };

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Dashboard"
        description="Overview of your diesel trading operations"
        primaryAction={{
          label: "Quick Sale",
          onClick: () => setShowNewSaleModal(true)
        }}
      />

      {/* Top alert strip if there are overdue clients */}
      {overdue && overdue.data && overdue.data.length > 0 && (
        <div className="mx-4 md:mx-6 mt-4">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {overdue.data.length} client(s) have invoices overdue by more than {overdue.days} days. Check the bell icon for details.
          </div>
        </div>
      )}

      <div className="p-4 md:p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Current Stock</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">
                    {overview?.currentStock?.toLocaleString() || "0"}
                  </p>
                  <p className="text-sm text-gray-600">Gallons</p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Fuel className="text-blue-600 w-5 h-5 lg:w-6 lg:h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">
                    {CURRENCY} {overview?.totalRevenue?.toLocaleString() || "0"}
                  </p>
                  <p className="text-sm text-green-600">
                    {overview?.grossMargin ? `${overview.grossMargin.toFixed(1)}% margin` : "0% margin"}
                  </p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-green-600 w-5 h-5 lg:w-6 lg:h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Pending LPOs</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">
                    {overview?.pendingLPOCount || 0}
                  </p>
                  <p className="text-sm text-orange-600">
                    {CURRENCY} {overview?.pendingLPOValue?.toLocaleString() || "0"} value
                  </p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="text-orange-600 w-5 h-5 lg:w-6 lg:h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Gross Profit</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">
                    {CURRENCY} {overview?.grossProfit?.toLocaleString() || "0"}
                  </p>
                  <p className="text-sm text-green-600">
                    Margin: {overview?.grossMargin?.toFixed(1) || "0"}%
                  </p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-green-600 w-5 h-5 lg:w-6 lg:h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Quick Actions */}
          <Card>
            <CardContent className="p-4 lg:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="flex flex-col items-center p-3 lg:p-4 h-auto border-2 border-dashed hover:border-blue-300 hover:bg-blue-50 min-h-[80px] lg:min-h-[100px]"
                      onClick={action.onClick}
                    >
                      <Icon className="text-blue-600 w-5 h-5 lg:w-6 lg:h-6 mb-2" />
                      <span className="text-xs lg:text-sm font-medium text-gray-700 text-center leading-tight">{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
                <button 
                  onClick={handleNavigateToSales}
                  className="text-blue-500 text-sm font-medium hover:text-blue-600"
                >
                  View all
                </button>
              </div>
              <div className="space-y-3 lg:space-y-4">
                {salesLoading ? (
                  <div className="text-gray-500">Loading recent sales...</div>
                ) : recentSales && recentSales.length > 0 ? (
                  recentSales.slice(0, 3).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{sale.client.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(sale.saleDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-medium text-gray-900 text-sm lg:text-base">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={sale.saleStatus as any} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-4">No sales recorded yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {overview && overview.currentStock < 5000 && (
          <Card className="mb-8 warning-50 border-warning-200">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 warning-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="text-white text-sm" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-warning-800 mb-2">Low Stock Alert</h3>
                  <p className="text-warning-700">
                    Current stock level ({overview.currentStock.toLocaleString()} gallons) is below the recommended threshold of 5,000 gallons. 
                    Consider purchasing additional stock to meet demand.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Sales Table */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Latest Sales</h3>
              <Button onClick={() => setShowNewSaleModal(true)} className="bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                New Sale
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Total Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salesLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        Loading sales...
                      </td>
                    </tr>
                  ) : recentSales && recentSales.length > 0 ? (
                    recentSales.slice(0, 5).map((sale) => (
                      <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">{sale.client.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {parseFloat(sale.quantityGallons).toLocaleString()} gal
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{sale.lpoNumber}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={sale.saleStatus as any} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={handleNavigateToSales}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewClick(sale.id)}
                              className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
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
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No sales recorded yet. Click "New Sale" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <NewSaleModal 
        open={showNewSaleModal} 
        onOpenChange={setShowNewSaleModal} 
      />
      <NewStockModal 
        open={showNewStockModal} 
        onOpenChange={setShowNewStockModal} 
      />
      <NewClientModal 
        open={showNewClientModal} 
        onOpenChange={setShowNewClientModal} 
      />
      <PaymentModal 
        open={showPaymentModal} 
        onOpenChange={setShowPaymentModal}
        saleId={selectedSaleId}
      />
      {selectedSaleId && (
        <ViewSaleModal 
          open={showViewSaleModal} 
          onOpenChange={setShowViewSaleModal}
          sale={recentSales?.find(s => s.id === selectedSaleId) || null}
        />
      )}
    </>
  );
}
