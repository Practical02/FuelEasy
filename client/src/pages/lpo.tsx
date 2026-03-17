import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { FilterPanel } from "@/components/ui/filter-panel";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EditSaleModal from "@/components/modals/edit-sale-modal";
import BulkRecordLpoModal from "@/components/modals/bulk-record-lpo-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardList, Pencil } from "lucide-react";
import { CURRENCY, STATUS_COLORS } from "@/lib/constants";
import { SALES_PAGE_SIZE } from "@/lib/sales-query";
import { apiRequest } from "@/lib/queryClient";
import type { SaleWithClient } from "@shared/schema";
import type { Client } from "@shared/schema";
import type { Project } from "@shared/schema";

export default function LPO() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkLpoModal, setShowBulkLpoModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "received">("all");
  const [lpoPage, setLpoPage] = useState(1);
  const [filterClientId, setFilterClientId] = useState<string>("all");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Fetch Pending LPO and LPO Received separately so we get all relevant sales (no pagination cutoff)
  const { data: pendingResponse } = useQuery<any>({
    queryKey: ["/api/sales?status=Pending%20LPO"],
  });
  const { data: receivedResponse } = useQuery<any>({
    queryKey: ["/api/sales?status=LPO%20Received"],
  });
  const pendingSales: SaleWithClient[] = Array.isArray(pendingResponse)
    ? pendingResponse
    : pendingResponse?.data ?? [];
  const receivedSales: SaleWithClient[] = Array.isArray(receivedResponse)
    ? receivedResponse
    : receivedResponse?.data ?? [];
  const sales: SaleWithClient[] = useMemo(() => {
    const combined = [...pendingSales, ...receivedSales];
    return combined.sort(
      (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );
  }, [pendingSales, receivedSales]);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => (await apiRequest("GET", "/api/clients")).json(),
  });
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => (await apiRequest("GET", "/api/projects")).json(),
  });

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (statusFilter === "pending") {
        if (sale.saleStatus !== "Pending LPO") return false;
      } else if (statusFilter === "received") {
        if (sale.saleStatus !== "LPO Received") return false;
      }
      if (filterClientId !== "all" && sale.clientId !== filterClientId) return false;
      if (filterProjectId !== "all" && sale.projectId !== filterProjectId) return false;
      if (filterDateFrom) {
        if (new Date(sale.saleDate) < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        if (new Date(sale.saleDate) > new Date(filterDateTo)) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchClient = sale.client?.name?.toLowerCase().includes(q);
        const matchLpo = sale.lpoNumber?.toLowerCase().includes(q);
        const matchDelivery = (sale as any).deliveryNoteNumber?.toLowerCase().includes(q);
        const matchProject = (sale as SaleWithClient).project?.name?.toLowerCase().includes(q);
        if (!matchClient && !matchLpo && !matchDelivery && !matchProject) return false;
      }
      return true;
    });
  }, [sales, statusFilter, searchTerm, filterClientId, filterProjectId, filterDateFrom, filterDateTo]);

  const hasActiveFilters = !!(filterClientId !== "all" || filterProjectId !== "all" || filterDateFrom || filterDateTo);
  const clearAdvancedFilters = () => {
    setFilterClientId("all");
    setFilterProjectId("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const lpoTotalPages = Math.max(1, Math.ceil(filteredSales.length / SALES_PAGE_SIZE));
  const lpoSafePage = Math.min(lpoPage, lpoTotalPages);
  const pagedLpo = useMemo(() => {
    const start = (lpoSafePage - 1) * SALES_PAGE_SIZE;
    return filteredSales.slice(start, start + SALES_PAGE_SIZE);
  }, [filteredSales, lpoSafePage]);

  useEffect(() => {
    setLpoPage(1);
  }, [statusFilter, searchTerm, filterClientId, filterProjectId, filterDateFrom, filterDateTo]);

  useEffect(() => {
    setLpoPage((p) => Math.min(p, lpoTotalPages));
  }, [lpoTotalPages]);

  const selectedSale = selectedSaleId
    ? (sales.find((s) => s.id === selectedSaleId) ?? null)
    : null;

  const pendingCount = sales.filter((s) => s.saleStatus === "Pending LPO").length;
  const receivedCount = sales.filter((s) => s.saleStatus === "LPO Received").length;

  const selectedCount = selectedIds.size;
  const pageIds = pagedLpo.map((s) => s.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <Header
        title="LPO"
        description="Record LPOs received for sales"
      />

      <div className="p-5 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by client, project, LPO or delivery note..."
            className="flex-1 max-w-md"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
            >
              Pending LPO ({pendingCount})
            </Button>
            <Button
              variant={statusFilter === "received" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("received")}
            >
              LPO Received ({receivedCount})
            </Button>
          </div>
        </div>

        <FilterPanel
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAdvancedFilters}
          title="Advanced search"
          className="mb-6"
        >
          {/* col-span-full so this block uses full FilterPanel width and doesn't get squeezed into one grid cell */}
          <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-6 w-full min-w-0">
            <div className="space-y-2 w-full min-w-0">
              <label className="text-sm font-medium text-gray-700">Client</label>
              <Select value={filterClientId} onValueChange={setFilterClientId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full min-w-0">
              <label className="text-sm font-medium text-gray-700">Project</label>
              <Select value={filterProjectId} onValueChange={setFilterProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 w-full min-w-0">
              <DateRangePicker
                startDate={filterDateFrom}
                endDate={filterDateTo}
                onStartDateChange={setFilterDateFrom}
                onEndDateChange={setFilterDateTo}
                onClear={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                label="Sale date range"
              />
            </div>
          </div>
        </FilterPanel>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <p className="text-sm text-gray-600">
            {filteredSales.length} sale(s) total
            {lpoTotalPages > 1 &&
              ` · rows ${(lpoSafePage - 1) * SALES_PAGE_SIZE + 1}–${Math.min(lpoSafePage * SALES_PAGE_SIZE, filteredSales.length)}`}
          </p>
          {lpoTotalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lpoSafePage <= 1}
                onClick={() => setLpoPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600 tabular-nums">
                Page {lpoSafePage} / {lpoTotalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lpoSafePage >= lpoTotalPages}
                onClick={() => setLpoPage((p) => Math.min(lpoTotalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-5 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium text-gray-900">
              {selectedCount} sale(s) selected
            </span>
            <Button
              size="sm"
              onClick={() => setShowBulkLpoModal(true)}
            >
              <ClipboardList className="w-4 h-4 mr-1" />
              Record LPO for selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-5 lg:p-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="w-12 py-4 px-4 text-left align-middle">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all on page"
                        className="h-4 w-4 shrink-0"
                      />
                    </th>
                    <th className="text-left py-4 px-5 font-medium text-gray-900">Client</th>
                    <th className="text-left py-4 px-5 font-medium text-gray-900">Project</th>
                    <th className="text-left py-4 px-5 font-medium text-gray-900">Sale Date</th>
                    <th className="text-right py-4 px-5 font-medium text-gray-900">Quantity</th>
                    <th className="text-right py-4 px-5 font-medium text-gray-900">Total</th>
                    <th className="text-center py-4 px-5 font-medium text-gray-900">Status</th>
                    <th className="text-left py-4 px-5 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-4 px-5 font-medium text-gray-900">Delivery Note</th>
                    <th className="text-left py-4 px-5 font-medium text-gray-900">LPO Received</th>
                    <th className="text-right py-4 px-5 font-medium text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-gray-500">
                        No sales match the filter. Record sales first, then record LPOs here.
                      </td>
                    </tr>
                  ) : (
                    pagedLpo.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="w-12 py-4 px-4 align-middle">
                          <Checkbox
                            checked={selectedIds.has(sale.id)}
                            onCheckedChange={() => toggleSelectOne(sale.id)}
                            aria-label={`Select sale ${sale.id}`}
                            className="h-4 w-4 shrink-0"
                          />
                        </td>
                        <td className="py-4 px-5 text-sm font-medium text-gray-900">
                          {(sale as SaleWithClient).client?.name ?? "—"}
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-600">
                          {(sale as SaleWithClient).project?.name ?? "—"}
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-600">
                          {new Date(sale.saleDate).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-5 text-sm text-right">
                          {parseFloat(sale.quantityGallons).toFixed(0)} gal
                        </td>
                        <td className="py-4 px-5 text-sm text-right font-medium">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <StatusBadge status={sale.saleStatus as keyof typeof STATUS_COLORS} />
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-600">
                          {sale.lpoNumber || "—"}
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-600">
                          {(sale as any).deliveryNoteNumber || "—"}
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-600">
                          {sale.lpoReceivedDate
                            ? new Date(sale.lpoReceivedDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSaleId(sale.id);
                              setShowEditModal(true);
                            }}
                          >
                            {sale.saleStatus === "Pending LPO" ? (
                              <>
                                <ClipboardList className="w-4 h-4 mr-1" />
                                Record LPO
                              </>
                            ) : (
                              <>
                                <Pencil className="w-4 h-4 mr-1" />
                                Edit LPO
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditSaleModal
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) setSelectedSaleId("");
        }}
        sale={selectedSale}
      />

      <BulkRecordLpoModal
        open={showBulkLpoModal}
        onOpenChange={setShowBulkLpoModal}
        saleIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </>
  );
}
