import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import NewStockModal from "@/components/modals/new-stock-modal";
import { CURRENCY } from "@/lib/constants";
import type { Stock } from "@shared/schema";

export default function Stock() {
  const [showNewStockModal, setShowNewStockModal] = useState(false);

  const { data: stock, isLoading } = useQuery<Stock[]>({
    queryKey: ["/api/stock"],
  });

  const { data: currentLevel } = useQuery({
    queryKey: ["/api/stock/current-level"],
  });

  const totalStockValue = stock?.reduce((sum, entry) => 
    sum + (parseFloat(entry.quantityGallons) * parseFloat(entry.purchasePricePerGallon)), 0
  ) || 0;

  const avgCostPerGallon = stock?.length 
    ? totalStockValue / stock.reduce((sum, entry) => sum + parseFloat(entry.quantityGallons), 0)
    : 0;

  return (
    <>
      <Header 
        title="Stock Management"
        description="Track diesel fuel inventory and purchases"
        primaryAction={{
          label: "Add Stock",
          onClick: () => setShowNewStockModal(true)
        }}
      />

      <div className="p-6">
        {/* Stock Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Current Stock Level</h3>
              <p className="text-3xl font-bold text-primary-600">
                {currentLevel?.currentLevel?.toLocaleString() || "0"}
              </p>
              <p className="text-gray-600">Gallons Available</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Stock Value</h3>
              <p className="text-3xl font-bold text-success-600">
                {CURRENCY} {totalStockValue.toLocaleString()}
              </p>
              <p className="text-gray-600">Investment Value</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Cost/Gallon</h3>
              <p className="text-3xl font-bold text-gray-900">
                {CURRENCY} {avgCostPerGallon.toFixed(3)}
              </p>
              <p className="text-gray-600">Weighted Average</p>
            </CardContent>
          </Card>
        </div>

        {/* Stock History */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Stock Purchase History</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Purchase Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity (Gallons)</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Price per Gallon</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Total Cost</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        Loading stock entries...
                      </td>
                    </tr>
                  ) : stock && stock.length > 0 ? (
                    stock.map((entry) => {
                      const quantity = parseFloat(entry.quantityGallons);
                      const pricePerGallon = parseFloat(entry.purchasePricePerGallon);
                      const totalCost = quantity * pricePerGallon;

                      return (
                        <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {new Date(entry.purchaseDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {quantity.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {CURRENCY} {pricePerGallon.toFixed(3)}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {CURRENCY} {totalCost.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No stock entries found. Click "Add Stock" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <NewStockModal 
        open={showNewStockModal} 
        onOpenChange={setShowNewStockModal} 
      />
    </>
  );
}
