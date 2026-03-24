import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { FilterPanel } from "@/components/ui/filter-panel";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { FileText, Trash2, Eye, PlusCircle, Pencil, Banknote } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CURRENCY } from "@/lib/constants";
import { isInLocalYmdRange } from "@/lib/date-range";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SALES_ALL_QUERY_KEY, fetchAllSales, salesListFromResponse } from "@/lib/sales-query";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, SaleWithClient } from "@shared/schema";
import NewInvoiceModal from "@/components/modals/new-invoice-modal";
import EditInvoiceModal from "@/components/modals/edit-invoice-modal";
import ViewInvoiceModal from "@/components/modals/view-invoice-modal";
import BulkInvoicePaymentModal from "@/components/modals/bulk-invoice-payment-modal";

export type InvoiceWithSale = Invoice & {
  sale: SaleWithClient;
};

function invoicePendingAmount(inv: InvoiceWithSale): number {
  return parseFloat((inv as { pendingAmount?: string }).pendingAmount || "0");
}

function isInvoicePayable(inv: InvoiceWithSale): boolean {
  return invoicePendingAmount(inv) > 0.009;
}

const INVOICE_STATUS_OPTIONS = [
  { value: "Generated", label: "Generated" },
  { value: "Sent", label: "Sent" },
  { value: "Paid", label: "Paid" },
];

export default function Invoices() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithSale | null>(null);
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false);
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPayRows, setBulkPayRows] = useState<
    { id: string; invoiceNumber: string; pendingAmount?: string }[]
  >([]);
  const { toast } = useToast();

  const { data: allInvoices, isLoading } = useQuery<InvoiceWithSale[]>({
    queryKey: ["/api/invoices"],
  });

  // Use all invoices since we're not using soft delete anymore
  const invoices = allInvoices || [];

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchInv = inv.invoiceNumber?.toLowerCase().includes(q);
        const matchClient = inv.sale?.client?.name?.toLowerCase().includes(q);
        const matchLpo = (inv.sale?.lpoNumber ?? (inv as any).lpoNumber)?.toLowerCase().includes(q);
        const matchProject = inv.sale?.project?.name?.toLowerCase().includes(q);
        if (!matchInv && !matchClient && !matchLpo && !matchProject) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(inv.status)) return false;
      if (!isInLocalYmdRange(inv.invoiceDate, startDate || undefined, endDate || undefined)) {
        return false;
      }
      return true;
    });
  }, [invoices, searchTerm, selectedStatuses, startDate, endDate]);

  const payableFiltered = useMemo(
    () => filteredInvoices.filter(isInvoicePayable),
    [filteredInvoices],
  );

  const allPayableSelected =
    payableFiltered.length > 0 &&
    payableFiltered.every((i) => selectedIds.has(i.id));

  const toggleSelectAllPayable = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPayableSelected) {
        payableFiltered.forEach((i) => next.delete(i.id));
      } else {
        payableFiltered.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const toggleRowSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBulkPay = () => {
    const list = invoices.filter((i) => selectedIds.has(i.id) && isInvoicePayable(i));
    if (list.length === 0) {
      toast({
        title: "Nothing to pay",
        description: "Select at least one invoice with a remaining balance.",
        variant: "destructive",
      });
      return;
    }
    const clientIds = new Set(list.map((i) => i.sale?.clientId).filter(Boolean));
    if (clientIds.size !== 1) {
      toast({
        title: "Same client required",
        description: "Use one payment for invoices from a single client only (e.g. one cheque).",
        variant: "destructive",
      });
      return;
    }
    setBulkPayRows(
      list.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        pendingAmount: (i as { pendingAmount?: string }).pendingAmount,
      })),
    );
    setBulkPayOpen(true);
  };

  const hasActiveFilters = !!(searchTerm || selectedStatuses.length > 0 || startDate || endDate);
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedStatuses([]);
    setStartDate("");
    setEndDate("");
  };

  const { data: salesResponse } = useQuery({
    queryKey: SALES_ALL_QUERY_KEY,
    queryFn: fetchAllSales,
  });
  const sales: SaleWithClient[] = salesListFromResponse(salesResponse) as SaleWithClient[];

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("DELETE", `/api/invoices/${invoiceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Invoice Deleted",
        description: "Invoice has been deleted and sale status reverted to 'LPO Received'.",
      });
      setShowDeleteDialog(false);
      setSelectedInvoice(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to delete invoice. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });



  const handleDeleteClick = (invoice: InvoiceWithSale) => {
    setSelectedInvoice(invoice);
    setShowDeleteDialog(true);
  };



  const handleEditClick = (invoice: InvoiceWithSale) => {
    setSelectedInvoice(invoice);
    setIsEditInvoiceModalOpen(true);
  };

  const handleViewClick = (invoice: InvoiceWithSale) => {
    setSelectedInvoice(invoice);
    setIsViewInvoiceModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedInvoice) {
      deleteInvoiceMutation.mutate(selectedInvoice.id);
    }
  };



  const totalInvoiceAmount = invoices?.reduce((sum, invoice) => 
    sum + parseFloat(invoice.totalAmount), 0
  ) || 0;

  return (
    <>
      <Header
        title="Invoices"
        description="Create invoices (Generated). Add the date you sent each one to the client to mark it Sent and set payment due. Record payment from the list—status becomes Paid when fully covered."
        primaryAction={{
          label: "Create Invoice",
          onClick: () => setIsNewInvoiceModalOpen(true),
        }}
      />

      <div className="p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by invoice number, client, project, or LPO..."
            className="flex-1 max-w-md"
          />
        </div>

        <FilterPanel
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
          title="Advanced search"
          className="mb-6"
        >
          <MultiSelectFilter
            options={INVOICE_STATUS_OPTIONS}
            selectedValues={selectedStatuses}
            onSelectionChange={setSelectedStatuses}
            label="Status"
            placeholder="Select statuses"
          />
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClear={() => { setStartDate(""); setEndDate(""); }}
            label="Invoice date range"
          />
        </FilterPanel>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50/80">
            <span className="text-sm font-medium text-gray-800">
              {selectedIds.size} invoice{selectedIds.size === 1 ? "" : "s"} selected
            </span>
            <Button type="button" size="sm" onClick={openBulkPay} className="gap-2">
              <Banknote className="h-4 w-4" />
              Record payment…
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        )}

        {/* Invoice Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {invoices?.length || 0}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Invoice Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {CURRENCY} {totalInvoiceAmount.toLocaleString()}
                  </p>
                </div>
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-green-600">{CURRENCY}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Generation</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {
                      (sales?.filter(
                        (sale) =>
                          sale.saleStatus === "LPO Received" &&
                          !invoices?.some((inv) => inv.saleId === sale.id)
                      ) || []).length
                    }
                  </p>
                </div>
                <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-orange-600">!</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Invoices List */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Active Invoices</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="w-10 py-3 px-2">
                      {payableFiltered.length > 0 ? (
                        <Checkbox
                          checked={allPayableSelected}
                          onCheckedChange={() => toggleSelectAllPayable()}
                          aria-label="Select all invoices with a balance in this list"
                        />
                      ) : null}
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Date sent</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-500">
                        Loading invoices...
                      </td>
                    </tr>
                  ) : filteredInvoices && filteredInvoices.length > 0 ? (
                    filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 align-middle">
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            disabled={!isInvoicePayable(invoice)}
                            onCheckedChange={() => toggleRowSelected(invoice.id)}
                            aria-label={`Select invoice ${invoice.invoiceNumber}`}
                          />
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {invoice.sale?.client?.name || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {invoice.sale?.project?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {(invoice as any).lpoNumber || invoice.sale?.lpoNumber || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(invoice.invoiceDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {invoice.submissionDate
                            ? new Date(invoice.submissionDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {CURRENCY} {parseFloat(invoice.totalAmount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              invoice.status === "Paid" ? "bg-green-100 text-green-600" :
                              invoice.status === "Sent" ? "bg-blue-100 text-blue-600" :
                              "bg-gray-100 text-gray-600"
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewClick(invoice)}
                              className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {/* PDF download removed as per requirements */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(invoice)}
                              className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(invoice)}
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
                      <td colSpan={10} className="py-8 text-center text-gray-500">
                        {invoices.length === 0 ? "No active invoices found." : "No invoices match the current filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>


      </div>

      <NewInvoiceModal
        open={isNewInvoiceModalOpen}
        onOpenChange={setIsNewInvoiceModalOpen}
      />

      <EditInvoiceModal
        open={isEditInvoiceModalOpen}
        onOpenChange={setIsEditInvoiceModalOpen}
        invoice={selectedInvoice}
      />

      <ViewInvoiceModal
        open={isViewInvoiceModalOpen}
        onOpenChange={setIsViewInvoiceModalOpen}
        invoice={selectedInvoice}
      />

      <BulkInvoicePaymentModal
        open={bulkPayOpen}
        onOpenChange={setBulkPayOpen}
        invoices={bulkPayRows}
        onRecorded={() => {
          setSelectedIds(new Set());
          setBulkPayRows([]);
        }}
      />

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Invoice"
        description={
          selectedInvoice
            ? `Are you sure you want to delete invoice "${selectedInvoice.invoiceNumber}"? This will delete the invoice and revert the sale status to "LPO Received" so you can generate a new invoice.`
            : "Are you sure you want to delete this invoice?"
        }
        confirmText="Delete Invoice"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteInvoiceMutation.isPending}
        variant="destructive"
      />


    </>
  );
}
