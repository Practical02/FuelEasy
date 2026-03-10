import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import EditSaleModal from "@/components/modals/edit-sale-modal";
import { ClipboardList, Pencil } from "lucide-react";
import { CURRENCY, STATUS_COLORS } from "@/lib/constants";
import type { SaleWithClient } from "@shared/schema";

export default function LPO() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "received">("all");

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

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (statusFilter === "pending") {
        if (sale.saleStatus !== "Pending LPO") return false;
      } else if (statusFilter === "received") {
        if (sale.saleStatus !== "LPO Received") return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchClient = sale.client?.name?.toLowerCase().includes(q);
        const matchLpo = sale.lpoNumber?.toLowerCase().includes(q);
        if (!matchClient && !matchLpo) return false;
      }
      return true;
    });
  }, [sales, statusFilter, searchTerm]);

  const selectedSale = selectedSaleId
    ? (sales.find((s) => s.id === selectedSaleId) ?? null)
    : null;

  const pendingCount = sales.filter((s) => s.saleStatus === "Pending LPO").length;
  const receivedCount = sales.filter((s) => s.saleStatus === "LPO Received").length;

  return (
    <>
      <Header
        title="LPO"
        description="Record LPOs received for sales"
      />

      <div className="p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by client or LPO number..."
            className="flex-1 max-w-md"
          />
          <div className="flex gap-2">
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

        <p className="text-sm text-gray-600 mb-4">
          Showing {filteredSales.length} sale(s). Record or edit LPO details for each sale.
        </p>

        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Sale Date</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Quantity</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Total</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Received</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Due</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        No sales match the filter. Record sales first, then record LPOs here.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {(sale as SaleWithClient).client?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(sale.saleDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {parseFloat(sale.quantityGallons).toFixed(0)} gal
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium">
                          {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={sale.saleStatus as keyof typeof STATUS_COLORS} />
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {sale.lpoNumber || "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {sale.lpoReceivedDate
                            ? new Date(sale.lpoReceivedDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {sale.lpoDueDate
                            ? new Date(sale.lpoDueDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
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
    </>
  );
}
