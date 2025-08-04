import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { insertPaymentSchema, type Payment, type SaleWithClient } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY, PAYMENT_METHODS } from "@/lib/constants";
import { z } from "zod";

const paymentFormSchema = insertPaymentSchema.extend({
  amountReceived: z.string().min(0.01, "Amount must be greater than 0."),
  paymentDate: z.coerce.date(),
});

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId?: string;
}

export default function PaymentModal({ open, onOpenChange, saleId }: PaymentModalProps) {
  const { toast } = useToast();

  const { data: sales } = useQuery<SaleWithClient[]>({
    queryKey: ["/api/sales"],
    enabled: !saleId, // Only fetch if no specific sale is provided
  });

  const { data: specificSale } = useQuery<SaleWithClient>({
    queryKey: ["/api/sales", saleId],
    enabled: !!saleId,
  });

  const { data: existingPayments } = useQuery<Payment[]>({
    queryKey: ["/api/payments/sale", saleId],
    enabled: !!saleId,
  });

  const form = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      saleId: saleId || "",
      paymentDate: new Date(),
      amountReceived: 0,
      paymentMethod: "",
      chequeNumber: "",
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof paymentFormSchema>) => {
      // Ensure all required fields are present and types are correct
      const paymentDate = (data.paymentDate instanceof Date ? data.paymentDate : new Date(data.paymentDate));
      const payload = {
        ...data,
        paymentDate: paymentDate.toISOString().split('T')[0], // Send as YYYY-MM-DD
        amountReceived: Number(data.amountReceived),
        chequeNumber: data.paymentMethod === "Cheque" ? (data.chequeNumber || null) : null,
      };
      const response = await apiRequest("POST", "/api/payments", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      if (saleId) {
        queryClient.invalidateQueries({ queryKey: ["/api/payments/sale", saleId] });
      }
      toast({
        title: "Payment Recorded",
        description: "Payment has been recorded successfully.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof paymentFormSchema>) => {
    createPaymentMutation.mutate(data);
  };

  // Get available sales for payment (unpaid only)
  const availableSales = sales?.filter(sale => sale.saleStatus !== "Paid") || [];
  
  // Calculate remaining amount for selected sale
  const selectedSaleId = form.watch("saleId") || saleId;
  const selectedSale = selectedSaleId 
    ? (specificSale || availableSales.find(s => s.id === selectedSaleId))
    : null;
  
  const totalPaid = existingPayments?.reduce((sum: number, payment: any) => 
    sum + parseFloat(payment.amountReceived), 0) || 0;
  
  const remainingAmount = selectedSale 
    ? parseFloat(selectedSale.totalAmount) - totalPaid 
    : 0;

  const showChequeField = form.watch("paymentMethod") === "Cheque";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment received from a client for their purchase.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[70vh] p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {!saleId && (
              <FormField
                control={form.control}
                name="saleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Sale</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a sale to record payment for..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableSales.map((sale) => (
                          <SelectItem key={sale.id} value={sale.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{sale.client.name} - {sale.lpoNumber}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedSale && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-gray-900">Sale Details</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Client:</span>
                    <span className="font-medium">{selectedSale.client.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">LPO Number:</span>
                    <span className="font-medium">{selectedSale.lpoNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium">
                      {CURRENCY} {parseFloat(selectedSale.totalAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Already Paid:</span>
                    <span className="font-medium">
                      {CURRENCY} {totalPaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-bold text-lg text-primary-600">
                      {CURRENCY} {remainingAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <StatusBadge status={selectedSale.saleStatus as any} />
                  </div>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : new Date(field.value).toISOString().split('T')[0]}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amountReceived"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount Received ({CURRENCY})</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showChequeField && (
              <FormField
                control={form.control}
                name="chequeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cheque Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter cheque number" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createPaymentMutation.isPending || !selectedSale}
                className="primary-500 text-white hover:primary-600"
              >
                {createPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
