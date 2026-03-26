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
import { Edit, Eye, CreditCard, Trash2, Users, Fuel, LayoutGrid } from "lucide-react";
import { CURRENCY, SALE_STATUSES } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  SALES_PAGE_SIZE,
  fetchSalesList,
  salesKeys,
  salesListFromResponse,
  type SalesListQuery,
} from "@/lib/sales-query";
import { useToast } from "@/hooks/use-toast";
import type { SaleWithClient, Client, Project } from "@shared/schema";

/** LPO, else delivery note no., else short id — never show the string "null". */
function saleLabelForDelete(sale: SaleWithClient | undefined): string {
  if (!sale) return "this sale";
  const lpo = sale.lpoNumber?.trim();
  if (lpo) return lpo;
  const dn = String((sale as { deliveryNoteNumber?: string | null }).deliveryNoteNumber ?? "").trim();
  if (dn) return dn;
  return `${sale.id.slice(0, 8)}…`;
}

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
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [salesPage, setSalesPage] = useState(1);
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<SaleWithClient | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<SaleWithClient | null>(null);

  const salesListQuery: SalesListQuery = useMemo(
    () => ({
      page: salesPage,
      limit: SALES_PAGE_SIZE,
      search: searchTerm.trim() || undefined,
      statuses: selectedStatuses.length ? [...selectedStatuses].sort() : undefined,
      clientIds: selectedClients.length ? [...selectedClients].sort() : undefined,
      projectIds: selectedProjects.length ? [...selectedProjects].sort() : undefined,
      dateFrom: startDate || undefined,
      dateTo: endDate || undefined,
      minAmount: minAmount || undefined,
      maxAmount: maxAmount || undefined,
      minQty: minQuantity || undefined,
      maxQty: maxQuantity || undefined,
    }),
    [
      salesPage,
      searchTerm,
      selectedStatuses,
      selectedClients,
      selectedProjects,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      minQuantity,
      maxQuantity,
    ],
  );

  const { data: salesResponse, isLoading } = useQuery({
    queryKey: salesKeys.list(salesListQuery),
    queryFn: () => fetchSalesList(salesListQuery),
  });

  const salesRows: SaleWithClient[] = salesListFromResponse(salesResponse) as SaleWithClient[];
  const pagination = salesResponse && typeof salesResponse === "object" && "pagination" in salesResponse
    ? (salesResponse as { pagination?: { total: number; totalPages: number; page: number; limit: number } }).pagination
    : undefined;
  const totalFiltered = pagination?.total ?? 0;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const safePage = Math.min(salesPage, totalPages);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => (await apiRequest("GET", "/api/clients")).json(),
  });
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => (await apiRequest("GET", "/api/projects")).json(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ saleId, status }: { saleId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/sales/${saleId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesKeys.root });
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
      queryClient.invalidateQueries({ queryKey: salesKeys.root });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/current-level"] });
      toast({
        title: "Sale Deleted",
        description: "Sale has been deleted successfully.",
      });
      setShowDeleteDialog(false);
      setSaleToDelete(null);
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

  useEffect(() => {
    setSalesPage(1);
  }, [
    searchTerm,
    selectedStatuses,
    selectedClients,
    selectedProjects,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    minQuantity,
    maxQuantity,
  ]);

  useEffect(() => {
    if (salesPage > totalPages) {
      setSalesPage(Math.max(1, totalPages));
    }
  }, [salesPage, totalPages]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || 
           selectedStatuses.length > 0 || 
           selectedClients.length > 0 || 
           selectedProjects.length > 0 || 
           startDate || 
           endDate || 
           minAmount || 
           maxAmount || 
           minQuantity || 
           maxQuantity);
  }, [searchTerm, selectedStatuses, selectedClients, selectedProjects, startDate, endDate, minAmount, maxAmount, minQuantity, maxQuantity]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedStatuses([]);
    setSelectedClients([]);
    setSelectedProjects([]);
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

  const projectOptions = projects?.map(project => ({
    value: project.id,
    label: project.name
  })) || [];

  const handlePaymentClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowEditSaleModal(false);
    setShowViewSaleModal(false);
    setShowPaymentModal(true);
  };





  const handleEditClick = (sale: SaleWithClient) => {
    setSelectedSaleForModal(sale);
    setSelectedSaleId(sale.id);
    setShowPaymentModal(false);
    setShowViewSaleModal(false);
    setShowEditSaleModal(true);
  };

  const handleViewClick = (sale: SaleWithClient) => {
    setSelectedSaleForModal(sale);
    setSelectedSaleId(sale.id);
    setShowPaymentModal(false);
    setShowEditSaleModal(false);
    setShowViewSaleModal(true);
  };

  const handleDeleteClick = (sale: SaleWithClient) => {
    setSaleToDelete(sale);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (saleToDelete) {
      deleteSaleMutation.mutate(saleToDelete.id);
    }
  };

  const handleCloseModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (open: boolean) => {
    setter(open);
    if (!open) {
      setSelectedSaleId("");
      setSelectedSaleForModal(null);
    }
  };

  return (
    <>
      <Header 
        title="Sales"
        description="Record and manage sales"
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
            placeholder="Search by LPO, client, project, or delivery note no..."
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

          <MultiSelectFilter
            options={projectOptions}
            selectedValues={selectedProjects}
            onSelectionChange={setSelectedProjects}
            label="Projects"
            placeholder="Select projects"
            icon={<LayoutGrid className="w-4 h-4" />}
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
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-gray-600">
            {totalFiltered === 0
              ? "0 sales"
              : `Rows ${(safePage - 1) * SALES_PAGE_SIZE + 1}–${Math.min(safePage * SALES_PAGE_SIZE, totalFiltered)} of ${totalFiltered}${hasActiveFilters ? " (filtered)" : ""}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600 tabular-nums">
                Page {safePage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setSalesPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
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
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Unit Price</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Total Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Delivery Note no.</th>
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
                  ) : totalFiltered > 0 ? (
                    salesRows.map((sale) => (
                      <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(sale.saleDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{sale.client.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {sale.project?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {parseFloat(sale.quantityGallons).toLocaleString()} gal
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {CURRENCY} {parseFloat(sale.salePricePerGallon).toFixed(3)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{(sale as any).deliveryNoteNumber ?? "—"}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={sale.saleStatus as any} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditClick(sale)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewClick(sale)}
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
                              onClick={() => handleDeleteClick(sale)}
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
              ) : totalFiltered > 0 ? (
                salesRows.map((sale) => (
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
                          <span className="text-gray-500">Project:</span>
                          <span className="ml-1 font-medium">{sale.project?.name ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Delivery Note no.:</span>
                          <span className="ml-1 font-medium">{(sale as any).deliveryNoteNumber ?? "—"}</span>
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
                            onClick={() => handleEditClick(sale)}
                            className="flex-1 sm:flex-none"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewClick(sale)}
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
                            onClick={() => handleDeleteClick(sale)}
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
      {showEditSaleModal && selectedSaleForModal && (
        <EditSaleModal 
          open={showEditSaleModal} 
          onOpenChange={(open) => handleCloseModal(setShowEditSaleModal)(open)}
          sale={selectedSaleForModal}
        />
      )}
      {showViewSaleModal && selectedSaleForModal && (
        <ViewSaleModal 
          open={showViewSaleModal} 
          onOpenChange={(open) => handleCloseModal(setShowViewSaleModal)(open)}
          sale={selectedSaleForModal}
        />
      )}
      {showPaymentModal && (
        <PaymentModal 
          open={showPaymentModal} 
          onOpenChange={(open) => handleCloseModal(setShowPaymentModal)(open)}
          saleId={selectedSaleId}
        />
      )}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setSaleToDelete(null);
        }}
        title="Delete Sale"
        description={
          (() => {
            const pending = saleToDelete ?? undefined;
            if (!pending) {
              return "Are you sure you want to delete this sale? This action cannot be undone and will remove all associated payment records.";
            }
            return `Are you sure you want to delete the sale "${saleLabelForDelete(pending)}"? This action cannot be undone and will remove all associated payment records.`;
          })()
        }
        confirmText="Delete Sale"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteSaleMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
