import { useState, useMemo } from "react";
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
import PaymentModal from "@/components/modals/payment-modal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Trash2, Users, CreditCard } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PaymentWithSaleAndClient, Client } from "@shared/schema";

export default function Payments() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithSaleAndClient | null>(null);
  const { toast } = useToast();

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const { data: payments, isLoading } = useQuery<PaymentWithSaleAndClient[]>({
    queryKey: ["/api/payments"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest("DELETE", `/api/payments/${paymentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      toast({
        title: "Payment Deleted",
        description: "Payment record has been deleted successfully.",
      });
      setShowDeleteDialog(false);
      setSelectedPayment(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (payment: PaymentWithSaleAndClient) => {
    setSelectedPayment(payment);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedPayment) {
      deletePaymentMutation.mutate(selectedPayment.id);
    }
  };

  // Filtering logic
  const filteredPayments = useMemo(() => {
    if (!payments) return [];

    return payments.filter((payment) => {
      // Search term filter (client name, LPO number, cheque number)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesClient = payment.sale.client.name.toLowerCase().includes(searchLower);
        const matchesLPO = payment.sale.lpoNumber.toLowerCase().includes(searchLower);
        const matchesCheque = payment.chequeNumber?.toLowerCase().includes(searchLower) || false;
        
        if (!matchesClient && !matchesLPO && !matchesCheque) {
          return false;
        }
      }

      // Client filter
      if (selectedClients.length > 0 && !selectedClients.includes(payment.sale.client.id)) {
        return false;
      }

      // Payment method filter
      if (selectedPaymentMethods.length > 0 && !selectedPaymentMethods.includes(payment.paymentMethod)) {
        return false;
      }

      // Date range filter
      if (startDate) {
        const paymentDate = new Date(payment.paymentDate);
        const filterStartDate = new Date(startDate);
        if (paymentDate < filterStartDate) {
          return false;
        }
      }

      if (endDate) {
        const paymentDate = new Date(payment.paymentDate);
        const filterEndDate = new Date(endDate);
        if (paymentDate > filterEndDate) {
          return false;
        }
      }

      // Amount range filter
      const paymentAmount = parseFloat(payment.amountReceived);
      if (minAmount && paymentAmount < parseFloat(minAmount)) {
        return false;
      }
      if (maxAmount && paymentAmount > parseFloat(maxAmount)) {
        return false;
      }

      return true;
    });
  }, [payments, searchTerm, selectedClients, selectedPaymentMethods, startDate, endDate, minAmount, maxAmount]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || 
           selectedClients.length > 0 || 
           selectedPaymentMethods.length > 0 || 
           startDate || 
           endDate || 
           minAmount || 
           maxAmount);
  }, [searchTerm, selectedClients, selectedPaymentMethods, startDate, endDate, minAmount, maxAmount]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedClients([]);
    setSelectedPaymentMethods([]);
    setStartDate("");
    setEndDate("");
    setMinAmount("");
    setMaxAmount("");
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

  // Prepare filter options
  const clientOptions = clients?.map(client => ({
    value: client.id,
    label: client.name
  })) || [];

  const paymentMethodOptions = [
    { value: "Cash", label: "Cash" },
    { value: "Cheque", label: "Cheque" },
    { value: "Bank Transfer", label: "Bank Transfer" },
    { value: "Credit Card", label: "Credit Card" }
  ];

  const totalPayments = filteredPayments.reduce((sum, payment) => 
    sum + parseFloat(payment.amountReceived), 0
  );

  const avgPayment = filteredPayments.length ? totalPayments / filteredPayments.length : 0;

  return (
    <>
      <Header 
        title="Payment Management"
        description="Track and record payments received from clients"
        primaryAction={{
          label: "Record Payment",
          onClick: () => setShowPaymentModal(true)
        }}
      />

      <div className="p-6">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by client name, LPO number, or cheque number..."
            className="flex-1 max-w-md"
          />
          <Button 
            onClick={() => setShowPaymentModal(true)}
            className="bg-primary-600 text-white hover:bg-primary-700"
          >
            Record Payment
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        <FilterPanel
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
          title="Payment Filters"
          className="mb-6"
        >
          <MultiSelectFilter
            options={clientOptions}
            selectedValues={selectedClients}
            onSelectionChange={setSelectedClients}
            label="Clients"
            placeholder="Select clients"
            icon={<Users className="w-4 h-4" />}
          />

          <MultiSelectFilter
            options={paymentMethodOptions}
            selectedValues={selectedPaymentMethods}
            onSelectionChange={setSelectedPaymentMethods}
            label="Payment Methods"
            placeholder="Select methods"
            icon={<CreditCard className="w-4 h-4" />}
          />

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClear={clearDateFilters}
            label="Payment Date Range"
          />

          <AmountRangeFilter
            minValue={minAmount}
            maxValue={maxAmount}
            onMinChange={setMinAmount}
            onMaxChange={setMaxAmount}
            onClear={clearAmountFilters}
            label="Amount Range"
            placeholder="Payment Amount"
          />
        </FilterPanel>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredPayments.length} of {payments?.length || 0} payments
            {hasActiveFilters && <span className="font-medium"> (filtered)</span>}
          </p>
        </div>

        {/* Payment Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Payments</h3>
              <p className="text-3xl font-bold text-success-600">
                {CURRENCY} {totalPayments.toLocaleString()}
              </p>
              <p className="text-gray-600">All time received</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Transactions</h3>
              <p className="text-3xl font-bold text-primary-600">
                {filteredPayments.length}
              </p>
              <p className="text-gray-600">{hasActiveFilters ? "Filtered" : ""} Payment records</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Payment</h3>
              <p className="text-3xl font-bold text-gray-900">
                {CURRENCY} {avgPayment.toLocaleString()}
              </p>
              <p className="text-gray-600">Per transaction</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
              <Button onClick={() => setShowPaymentModal(true)} className="bg-blue-600 text-white hover:bg-blue-700">
                Record Payment
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Payment Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">LPO Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Amount Received</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Payment Method</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Cheque Number</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Sale Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        Loading payments...
                      </td>
                    </tr>
                  ) : filteredPayments && filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(payment.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {payment.sale.client.name}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {payment.sale.lpoNumber}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {CURRENCY} {parseFloat(payment.amountReceived).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {payment.paymentMethod}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {payment.chequeNumber || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={payment.sale.saleStatus as any} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(payment)}
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
                        {hasActiveFilters
                          ? "No payments match your current filters. Try adjusting the filters or clearing them."
                          : "No payments recorded yet. Click \"Record Payment\" to get started."
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

      <PaymentModal 
        open={showPaymentModal} 
        onOpenChange={setShowPaymentModal}
      />
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Payment"
        description={
          selectedPayment
            ? `Are you sure you want to delete the payment of ${CURRENCY} ${parseFloat(selectedPayment.amountReceived).toLocaleString()} from ${selectedPayment.sale.client.name}? This action cannot be undone and may affect the sale status.`
            : "Are you sure you want to delete this payment?"
        }
        confirmText="Delete Payment"
        onConfirm={handleDeleteConfirm}
        isLoading={deletePaymentMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
