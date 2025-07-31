import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { AmountRangeFilter } from "@/components/ui/amount-range-filter";
import { FilterPanel } from "@/components/ui/filter-panel";
import NewStockModal from "@/components/modals/new-stock-modal";
import EditStockModal from "@/components/modals/edit-stock-modal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Edit, Trash2, Fuel } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Stock } from "@shared/schema";

export default function Stock() {
  const [showNewStockModal, setShowNewStockModal] = useState(false);
  const [showEditStockModal, setShowEditStockModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const { toast } = useToast();

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [minCost, setMinCost] = useState("");
  const [maxCost, setMaxCost] = useState("");

  const { data: stock, isLoading } = useQuery<Stock[]>({
    queryKey: ["/api/stock"],
  });

  const { data: currentLevel } = useQuery<{ currentLevel: number }>({
    queryKey: ["/api/stock/current-level"],
  });

  const totalStockValue = stock?.reduce((sum, entry) => 
    sum + (parseFloat(entry.quantityGallons) * parseFloat(entry.purchasePricePerGallon)), 0
  ) || 0;

  const avgCostPerGallon = stock?.length 
    ? totalStockValue / stock.reduce((sum, entry) => sum + parseFloat(entry.quantityGallons), 0)
    : 0;

  const deleteStockMutation = useMutation({
    mutationFn: async (stockId: string) => {
      const response = await apiRequest("DELETE", `/api/stock/${stockId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/current-level"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      toast({
        title: "Stock Deleted",
        description: "Stock entry has been deleted successfully.",
      });
      setShowDeleteDialog(false);
      setSelectedStock(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete stock entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (stockEntry: Stock) => {
    setSelectedStock(stockEntry);
    setShowEditStockModal(true);
  };

  const handleDeleteClick = (stockEntry: Stock) => {
    setSelectedStock(stockEntry);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedStock) {
      deleteStockMutation.mutate(selectedStock.id);
    }
  };

  // Filtering logic
  const filteredStock = useMemo(() => {
    if (!stock) return [];

    return stock.filter((entry) => {
      // Date range filter
      if (startDate) {
        const entryDate = new Date(entry.purchaseDate);
        const filterStartDate = new Date(startDate);
        if (entryDate < filterStartDate) {
          return false;
        }
      }

      if (endDate) {
        const entryDate = new Date(entry.purchaseDate);
        const filterEndDate = new Date(endDate);
        if (entryDate > filterEndDate) {
          return false;
        }
      }

      // Quantity range filter
      const quantity = parseFloat(entry.quantityGallons);
      if (minQuantity && quantity < parseFloat(minQuantity)) {
        return false;
      }
      if (maxQuantity && quantity > parseFloat(maxQuantity)) {
        return false;
      }

      // Cost range filter
      const totalCost = parseFloat(entry.totalCost);
      if (minCost && totalCost < parseFloat(minCost)) {
        return false;
      }
      if (maxCost && totalCost > parseFloat(maxCost)) {
        return false;
      }

      return true;
    });
  }, [stock, startDate, endDate, minQuantity, maxQuantity, minCost, maxCost]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(startDate || endDate || minQuantity || maxQuantity || minCost || maxCost);
  }, [startDate, endDate, minQuantity, maxQuantity, minCost, maxCost]);

  // Clear all filters
  const clearAllFilters = () => {
    setStartDate("");
    setEndDate("");
    setMinQuantity("");
    setMaxQuantity("");
    setMinCost("");
    setMaxCost("");
  };

  // Clear date filters
  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  // Clear quantity filters
  const clearQuantityFilters = () => {
    setMinQuantity("");
    setMaxQuantity("");
  };

  // Clear cost filters
  const clearCostFilters = () => {
    setMinCost("");
    setMaxCost("");
  };

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
        {/* Advanced Filters Panel */}
        <FilterPanel
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
          title="Stock Filters"
          className="mb-6"
        >
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClear={clearDateFilters}
            label="Purchase Date Range"
          />

          <AmountRangeFilter
            minValue={minQuantity}
            maxValue={maxQuantity}
            onMinChange={setMinQuantity}
            onMaxChange={setMaxQuantity}
            onClear={clearQuantityFilters}
            label="Quantity Range"
            placeholder="Gallons"
            icon={<Fuel className="w-4 h-4" />}
          />

          <AmountRangeFilter
            minValue={minCost}
            maxValue={maxCost}
            onMinChange={setMinCost}
            onMaxChange={setMaxCost}
            onClear={clearCostFilters}
            label="Cost Range"
            placeholder="Total Cost"
          />
        </FilterPanel>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredStock.length} of {stock?.length || 0} stock entries
            {hasActiveFilters && <span className="font-medium"> (filtered)</span>}
          </p>
        </div>

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
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        Loading stock entries...
                      </td>
                    </tr>
                  ) : filteredStock && filteredStock.length > 0 ? (
                    filteredStock.map((entry) => {
                      const quantity = parseFloat(entry.quantityGallons);
                      const pricePerGallon = parseFloat(entry.purchasePricePerGallon);
                      const totalCost = parseFloat(entry.totalCost);

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
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(entry)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(entry)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        {hasActiveFilters
                          ? "No stock entries match your current filters. Try adjusting the filters or clearing them."
                          : "No stock entries found. Click \"Add Stock\" to get started."
                        }
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
      <EditStockModal 
        open={showEditStockModal} 
        onOpenChange={setShowEditStockModal}
        stock={selectedStock}
      />
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Stock Entry"
        description={
          selectedStock
            ? `Are you sure you want to delete the stock entry from ${new Date(selectedStock.purchaseDate).toLocaleDateString()}? This action cannot be undone and will affect your current stock levels.`
            : "Are you sure you want to delete this stock entry?"
        }
        confirmText="Delete Entry"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteStockMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
