import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import type { SaleWithClient } from "@shared/schema";

export default function Reports() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["/api/reports/overview"],
  });

  const { data: pendingLPOs } = useQuery<SaleWithClient[]>({
    queryKey: ["/api/sales", "Pending LPO"],
  });

  const { data: overdueLPOs } = useQuery<SaleWithClient[]>({
    queryKey: ["/api/sales"],
    select: (data) => data?.filter(sale => 
      (sale.saleStatus === "Pending LPO" || sale.saleStatus === "LPO Received") &&
      new Date(sale.lpoDueDate) < new Date()
    ) || []
  });

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading reports...</div>
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Reports & Analytics"
        description="Business insights and financial reporting"
      />

      <div className="p-6">
        {/* Financial Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {CURRENCY} {overview?.totalRevenue?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="w-12 h-12 success-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-success-500 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Cost of Goods Sold</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {CURRENCY} {overview?.totalCOGS?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="w-12 h-12 error-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="text-error-500 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Gross Profit</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {CURRENCY} {overview?.grossProfit?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="w-12 h-12 primary-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-primary-500 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Gross Margin</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {overview?.grossMargin?.toFixed(1) || "0"}%
                  </p>
                </div>
                <div className="w-12 h-12 warning-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-warning-500 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outstanding Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pending LPOs */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending LPOs</h3>
              <div className="space-y-4">
                {pendingLPOs && pendingLPOs.length > 0 ? (
                  pendingLPOs.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{sale.client.name}</p>
                        <p className="text-sm text-gray-500">{sale.lpoNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          Due: {new Date(sale.lpoDueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No pending LPOs</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Overdue Items */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 text-error-500 mr-2" />
                Overdue LPOs
              </h3>
              <div className="space-y-4">
                {overdueLPOs && overdueLPOs.length > 0 ? (
                  overdueLPOs.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{sale.client.name}</p>
                        <p className="text-sm text-error-600">{sale.lpoNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </p>
                        <p className="text-sm text-error-600">
                          Overdue since: {new Date(sale.lpoDueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No overdue LPOs</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Reports */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Business Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Stock Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Stock:</span>
                    <span className="font-medium">{overview?.currentStock?.toLocaleString() || "0"} gal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stock Status:</span>
                    <span className={overview?.currentStock < 5000 ? "text-error-600 font-medium" : "text-success-600 font-medium"}>
                      {overview?.currentStock < 5000 ? "Low Stock" : "Adequate"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Sales Performance</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending LPOs:</span>
                    <span className="font-medium">{overview?.pendingLPOCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending Value:</span>
                    <span className="font-medium">{CURRENCY} {overview?.pendingLPOValue?.toLocaleString() || "0"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Profitability</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Profit Margin:</span>
                    <span className="font-medium">{overview?.grossMargin?.toFixed(1) || "0"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className={`font-medium ${
                      (overview?.grossMargin || 0) > 15 
                        ? "text-success-600" 
                        : (overview?.grossMargin || 0) > 8 
                          ? "text-warning-600" 
                          : "text-error-600"
                    }`}>
                      {(overview?.grossMargin || 0) > 15 
                        ? "Excellent" 
                        : (overview?.grossMargin || 0) > 8 
                          ? "Good" 
                          : "Needs Improvement"
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
