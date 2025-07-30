import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import PaymentModal from "@/components/modals/payment-modal";
import { CURRENCY } from "@/lib/constants";
import type { PaymentWithSaleAndClient } from "@shared/schema";

export default function Payments() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const { data: payments, isLoading } = useQuery<PaymentWithSaleAndClient[]>({
    queryKey: ["/api/payments"],
  });

  const totalPayments = payments?.reduce((sum, payment) => 
    sum + parseFloat(payment.amountReceived), 0
  ) || 0;

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
                {payments?.length || 0}
              </p>
              <p className="text-gray-600">Payment records</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Payment</h3>
              <p className="text-3xl font-bold text-gray-900">
                {CURRENCY} {payments?.length ? (totalPayments / payments.length).toLocaleString() : "0"}
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
              <Button onClick={() => setShowPaymentModal(true)} className="primary-500 text-white hover:primary-600">
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
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        Loading payments...
                      </td>
                    </tr>
                  ) : payments && payments.length > 0 ? (
                    payments.map((payment) => (
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No payments recorded yet. Click "Record Payment" to get started.
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
    </>
  );
}
