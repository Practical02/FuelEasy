import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FileText, Download, Trash2, Eye } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, SaleWithClient } from "@shared/schema";

type InvoiceWithSale = Invoice & {
  sale: SaleWithClient;
};

export default function Invoices() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  const { data: invoices, isLoading } = useQuery<InvoiceWithSale[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: sales } = useQuery<SaleWithClient[]>({
    queryKey: ["/api/sales"],
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const sale = sales?.find(s => s.id === saleId);
      if (!sale) throw new Error("Sale not found");

      const invoiceNumber = `INV-${sale.lpoNumber}`;
      const invoiceData = {
        saleId: sale.id,
        invoiceNumber,
        invoiceDate: new Date(),
        totalAmount: sale.totalAmount,
        vatAmount: sale.vatAmount,
        status: "Generated"
      };

      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Invoice Generated",
        description: "Invoice has been generated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("DELETE", `/api/invoices/${invoiceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Deleted",
        description: "Invoice has been deleted successfully.",
      });
      setShowDeleteDialog(false);
      setSelectedInvoice(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateInvoice = (saleId: string) => {
    createInvoiceMutation.mutate(saleId);
  };

  const handleDeleteClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedInvoice) {
      deleteInvoiceMutation.mutate(selectedInvoice.id);
    }
  };

  // Get invoiceable sales (LPO Received status)
  const invoiceableSales = sales?.filter(sale => 
    sale.saleStatus === "LPO Received" && 
    !invoices?.some(inv => inv.saleId === sale.id)
  ) || [];

  const totalInvoiceAmount = invoices?.reduce((sum, invoice) => 
    sum + parseFloat(invoice.totalAmount), 0
  ) || 0;

  return (
    <>
      <Header 
        title="Invoice Management"
        description="Generate and manage invoices for your sales"
      />

      <div className="p-4 lg:p-6">
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
                    {invoiceableSales.length}
                  </p>
                </div>
                <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-orange-600">!</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generate Invoices Section */}
        {invoiceableSales.length > 0 && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ready for Invoice Generation</h3>
              <div className="space-y-3">
                {invoiceableSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{sale.client.name}</p>
                      <p className="text-sm text-gray-500">
                        LPO: {sale.lpoNumber} • {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleGenerateInvoice(sale.id)}
                      disabled={createInvoiceMutation.isPending}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {createInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice List */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">All Invoices</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        Loading invoices...
                      </td>
                    </tr>
                  ) : invoices && invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {invoice.sale?.client?.name || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {invoice.sale?.lpoNumber || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(invoice.invoiceDate).toLocaleDateString()}
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
                              className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Download className="w-4 h-4" />
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
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No invoices generated yet. Invoices will appear here once you generate them from eligible sales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Invoice"
        description={
          selectedInvoice
            ? `Are you sure you want to delete invoice "${selectedInvoice.invoiceNumber}"? This action cannot be undone.`
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