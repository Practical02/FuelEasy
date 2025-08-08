import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FileText, Download, Trash2, Eye, PlusCircle, Pencil } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, SaleWithClient } from "@shared/schema";
import NewInvoiceModal from "@/components/modals/new-invoice-modal";
import EditInvoiceModal from "@/components/modals/edit-invoice-modal";
import ViewInvoiceModal from "@/components/modals/view-invoice-modal";
import { generateInvoicePDFWithSettings } from "@/lib/pdf";

export type InvoiceWithSale = Invoice & {
  sale: SaleWithClient;
};

export default function Invoices() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithSale | null>(null);
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false);
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: allInvoices, isLoading } = useQuery<InvoiceWithSale[]>({
    queryKey: ["/api/invoices"],
  });

  // Use all invoices since we're not using soft delete anymore
  const invoices = allInvoices || [];

  const { data: salesResponse } = useQuery<any>({
    queryKey: ["/api/sales"],
  });
  const sales: SaleWithClient[] = Array.isArray(salesResponse)
    ? (salesResponse as SaleWithClient[])
    : (salesResponse?.data ?? []);

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
        title="Invoice Management"
        description="Generate and manage invoices for your sales"
        primaryAction={{
          label: "Create Invoice",
          onClick: () => setIsNewInvoiceModalOpen(true),
        }}
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
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Pending Amount</th>
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
                        <td className="py-3 px-4 text-sm font-medium text-red-600">
                          {CURRENCY} {parseFloat(invoice.sale.pendingAmount || "0").toLocaleString()}
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generateInvoicePDFWithSettings(invoice)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
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
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        No active invoices found.
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
