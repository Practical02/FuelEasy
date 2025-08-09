import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { AmountRangeFilter } from "@/components/ui/amount-range-filter";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NewSaleModal from "@/components/modals/new-sale-modal";
import EditSaleModal from "@/components/modals/edit-sale-modal";
import ViewSaleModal from "@/components/modals/view-sale-modal";
import PaymentModal from "@/components/modals/payment-modal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Edit, Eye, CreditCard, Trash2, Users, Fuel } from "lucide-react";
import { CURRENCY, SALE_STATUSES } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SaleWithClient, Client } from "@shared/schema";

export default function Sales() {
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showEditSaleModal, setShowEditSaleModal] = useState(false);
  const [showViewSaleModal, setShowViewSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const { toast } = useToast();

  

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");

  const { data: salesResponse, isLoading } = useQuery<any>({
    queryKey: ["/api/sales"],
    queryFn: async () => (await apiRequest("GET", "/api/sales")).json(),
  });

  const sales: SaleWithClient[] = Array.isArray(salesResponse)
    ? salesResponse
    : (salesResponse?.data ?? []);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => (await apiRequest("GET", "/api/clients")).json(),
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

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const response = await apiRequest("DELETE", `/api/sales/${saleId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/current-level"] });
      toast({
        title: "Sale Deleted",
        description: "Sale has been deleted successfully.",
      });
      setShowDeleteDialog(false);
      setSelectedSaleId("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (saleId: string, newStatus: string) => {
    updateStatusMutation.mutate({ saleId, status: newStatus });
  };

  // Filtering logic
  const filteredSales = useMemo(() => {
    if (!sales) return [];

    return sales.filter((sale) => {
      // Search term filter (LPO number, client name)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesLPO = sale.lpoNumber?.toLowerCase().includes(searchLower) || false;
        const matchesClient = sale.client.name.toLowerCase().includes(searchLower);
        const matchesContact = sale.client.contactPerson.toLowerCase().includes(searchLower);
        
        if (!matchesLPO && !matchesClient && !matchesContact) {
          return false;
        }
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(sale.saleStatus)) {
        return false;
      }

      // Client filter
      if (selectedClients.length > 0 && !selectedClients.includes(sale.clientId)) {
        return false;
      }

      // Date range filter
      if (startDate) {
        const saleDate = new Date(sale.saleDate);
        const filterStartDate = new Date(startDate);
        if (saleDate < filterStartDate) {
          return false;
        }
      }

      if (endDate) {
        const saleDate = new Date(sale.saleDate);
        const filterEndDate = new Date(endDate);
        if (saleDate > filterEndDate) {
          return false;
        }
      }

      // Amount range filter
      const saleAmount = parseFloat(sale.totalAmount);
      if (minAmount && saleAmount < parseFloat(minAmount)) {
        return false;
      }
      if (maxAmount && saleAmount > parseFloat(maxAmount)) {
        return false;
      }

      // Quantity range filter
      const saleQuantity = parseFloat(sale.quantityGallons);
      if (minQuantity && saleQuantity < parseFloat(minQuantity)) {
        return false;
      }
      if (maxQuantity && saleQuantity > parseFloat(maxQuantity)) {
        return false;
      }

      return true;
    });
  }, [sales, searchTerm, selectedStatuses, selectedClients, startDate, endDate, minAmount, maxAmount, minQuantity, maxQuantity]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || 
           selectedStatuses.length > 0 || 
           selectedClients.length > 0 || 
           startDate || 
           endDate || 
           minAmount || 
           maxAmount || 
           minQuantity || 
           maxQuantity);
  }, [searchTerm, selectedStatuses, selectedClients, startDate, endDate, minAmount, maxAmount, minQuantity, maxQuantity]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedStatuses([]);
    setSelectedClients([]);
    setStartDate("");
    setEndDate("");
    setMinAmount("");
    setMaxAmount("");
    setMinQuantity("");
    setMaxQuantity("");
  };

  // Clear date filters
  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  // Clear amount filters
  const clearAmountFilters = () => {
    setMinAmount("");
    setMaxAmount("");
  };

  // Clear quantity filters
  const clearQuantityFilters = () => {
    setMinQuantity("");
    setMaxQuantity("");
  };

  // Prepare filter options
  const statusOptions = SALE_STATUSES.map(status => ({
    value: status,
    label: status
  }));

  const clientOptions = clients?.map(client => ({
    value: client.id,
    label: client.name
  })) || [];

  const handlePaymentClick = (saleId: string) => {
    setSelectedSaleId(saleId);
  };





  const handleEditClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowPaymentModal(false);
    setShowEditSaleModal(true);
  };

  const handleViewClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowPaymentModal(false);
    setShowViewSaleModal(true);
  };

  const handleDeleteClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedSaleId) {
      deleteSaleMutation.mutate(selectedSaleId);
    }
  };



  const handleCloseModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (open: boolean) => {
    setter(open);
    if (!open) {
      setSelectedSaleId("");
    }
  };

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
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by LPO number, client name, or contact person..."
            className="flex-1 max-w-md"
          />
          <Button 
            onClick={() => setShowNewSaleModal(true)}
            className="bg-primary-600 text-white hover:bg-primary-700"
          >
            New Sale
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        <FilterPanel
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
          title="Advanced Filters"
        >
          <MultiSelectFilter
            options={statusOptions}
            selectedValues={selectedStatuses}
            onSelectionChange={setSelectedStatuses}
            label="Status"
            placeholder="Select statuses"
          />
          
          <MultiSelectFilter
            options={clientOptions}
            selectedValues={selectedClients}
            onSelectionChange={setSelectedClients}
            label="Clients"
            placeholder="Select clients"
            icon={<Users className="w-4 h-4" />}
          />

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClear={clearDateFilters}
            label="Sale Date Range"
          />

          <AmountRangeFilter
            minValue={minAmount}
            maxValue={maxAmount}
            onMinChange={setMinAmount}
            onMaxChange={setMaxAmount}
            onClear={clearAmountFilters}
            label="Amount Range"
            placeholder="Amount"
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
        </FilterPanel>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredSales.length} of {sales?.length || 0} sales
            {hasActiveFilters && <span className="font-medium"> (filtered)</span>}
          </p>
        </div>

        <Card>
          <CardContent className="p-4 lg:p-6">

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
                          {sale.lpoDueDate ? new Date(sale.lpoDueDate).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={sale.saleStatus as any} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditClick(sale.id)}
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
                            {sale.saleStatus === "Invoiced" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePaymentClick(sale.id)}
                                className="text-green-600 hover:text-green-800 hover:bg-green-50"
                              >
                                <CreditCard className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(sale.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        {hasActiveFilters 
                          ? "No sales match your current filters. Try adjusting the filters or clearing them."
                          : "No sales recorded yet. Click 'New Sale' to get started."
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
                        <div className="flex-1">
                          <StatusBadge status={sale.saleStatus as any} />
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditClick(sale.id)}
                            className="flex-1 sm:flex-none"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewClick(sale.id)}
                            className="flex-1 sm:flex-none"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {sale.saleStatus === "Invoiced" && (
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(sale.id)}
                            className="flex-1 sm:flex-none bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500">
                  {hasActiveFilters 
                    ? "No sales match your current filters. Try adjusting the filters or clearing them."
                    : "No sales recorded yet. Click 'New Sale' to get started."
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <NewSaleModal 
        open={showNewSaleModal} 
        onOpenChange={(open) => handleCloseModal(setShowNewSaleModal)(open)} 
      />
      {selectedSaleId && (
        <EditSaleModal 
          open={showEditSaleModal} 
          onOpenChange={(open) => handleCloseModal(setShowEditSaleModal)(open)}
          sale={filteredSales.find(s => s.id === selectedSaleId)!}
        />
      )}
      {selectedSaleId && (
        <ViewSaleModal 
          open={showViewSaleModal} 
          onOpenChange={(open) => handleCloseModal(setShowViewSaleModal)(open)}
          sale={filteredSales.find(s => s.id === selectedSaleId) || null}
        />
      )}
      <PaymentModal 
        open={showPaymentModal} 
        onOpenChange={(open) => handleCloseModal(setShowPaymentModal)(open)}
        saleId={selectedSaleId}
      />
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Sale"
        description={
          selectedSaleId && filteredSales.find(s => s.id === selectedSaleId)
            ? `Are you sure you want to delete the sale "${filteredSales.find(s => s.id === selectedSaleId)?.lpoNumber}"? This action cannot be undone and will remove all associated payment records.`
            : "Are you sure you want to delete this sale?"
        }
        confirmText="Delete Sale"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteSaleMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
