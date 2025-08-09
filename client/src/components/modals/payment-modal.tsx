import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { z } from "zod";

// Simplified schema for simple payment
const paymentFormSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  saleId: z.string().min(1, "Please select a sale"),
  paymentDate: z.coerce.date(),
  paymentMethod: z.string().min(1, "Payment method is required"),
  amountReceived: z.number().min(0.01, "Amount must be greater than 0"),
  chequeNumber: z.string().optional(),
  notes: z.string().optional(),
});

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId?: string;
}

export default function PaymentModal({ open, onOpenChange, saleId }: PaymentModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Fetch data
  const { data: salesResponse } = useQuery<any>({
    queryKey: ["/api/sales"],
    enabled: open,
    queryFn: async () => (await apiRequest("GET", "/api/sales")).json(),
  });
  const sales: any[] = Array.isArray(salesResponse)
    ? (salesResponse as any[])
    : (salesResponse?.data ?? []);

  const { data: clients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: open,
    queryFn: async () => (await apiRequest("GET", "/api/clients")).json(),
  });

  // If a specific sale is provided, fetch its details and payments
  const { data: selectedSale } = useQuery<any>({
    queryKey: [`/api/sales/${saleId}`],
    enabled: open && !!saleId,
    queryFn: async () => (await apiRequest("GET", `/api/sales/${saleId}`)).json(),
  });

  const { data: salePayments } = useQuery<any[]>({
    queryKey: [`/api/payments/sale/${saleId}`],
    enabled: open && !!saleId,
    queryFn: async () => (await apiRequest("GET", `/api/payments/sale/${saleId}`)).json(),
  });

  // Get unpaid sales for selected client
  const clientUnpaidSales = sales?.filter(sale => 
    sale.clientId === selectedClientId && 
    sale.saleStatus !== "Paid"
  ) || [];

  const form = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      clientId: "",
      saleId: "",
      paymentDate: new Date(),
      paymentMethod: "",
      amountReceived: 0,
      chequeNumber: "",
      notes: "",
    },
  });

  // When sale is provided, prefill client, sale and amount with remaining
  const totalPaid = (salePayments || []).reduce((sum, p) => sum + parseFloat(p.amountReceived), 0);
  const saleTotal = selectedSale ? parseFloat(selectedSale.totalAmount) : 0;
  const remainingAmount = Math.max(0, saleTotal - totalPaid);

  // Prefill once when selected sale loads
  useEffect(() => {
    if (open && saleId && selectedSale && form.getValues("saleId") !== selectedSale.id) {
      setSelectedClientId(selectedSale.clientId);
      form.setValue("clientId", selectedSale.clientId);
      form.setValue("saleId", selectedSale.id);
      form.setValue("amountReceived", remainingAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saleId, selectedSale?.id]);

  const createPaymentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof paymentFormSchema>) => {
      const payload = {
        saleId: data.saleId,
        paymentDate: data.paymentDate.toISOString().split('T')[0],
        paymentMethod: data.paymentMethod,
        amountReceived: data.amountReceived,
        chequeNumber: data.paymentMethod === "Cheque" ? data.chequeNumber : null,
      };
      const response = await apiRequest("POST", "/api/payments", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] });
      toast({
        title: "Payment Recorded Successfully",
        description: "The payment has been recorded, allocated to the invoice, and the sale has been updated.",
      });
      form.reset();
      setSelectedClientId("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error?.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof paymentFormSchema>) => {
    createPaymentMutation.mutate(data);
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    form.setValue("clientId", clientId);
    form.setValue("saleId", "");
    form.setValue("amountReceived", 0);
  };

  const handleSaleChange = (saleId: string) => {
    const sale = clientUnpaidSales.find(s => s.id === saleId);
    if (sale) {
      form.setValue("saleId", saleId);
      form.setValue("amountReceived", parseFloat(sale.totalAmount));
    }
  };

  const showChequeField = form.watch("paymentMethod") === "Cheque";

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogDescription>
          Record a payment received from a client for a specific sale.
        </DialogDescription>
      </DialogHeader>

      {selectedSale && (
        <div className="space-y-2 mb-4">
          <h3 className="text-base font-semibold">Sale Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">Client:</div>
            <div className="font-medium">{selectedSale.client?.name || clients?.find(c => c.id === selectedSale.clientId)?.name || "N/A"}</div>
            <div className="text-gray-600">LPO Number:</div>
            <div className="font-medium">{selectedSale.lpoNumber || "N/A"}</div>
            <div className="text-gray-600">Total Amount:</div>
            <div className="font-medium">{CURRENCY} {saleTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-gray-600">Already Paid:</div>
            <div className="font-medium">{CURRENCY} {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-gray-600">Remaining:</div>
            <div className="font-medium">{CURRENCY} {remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={handleClientChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a client..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedClientId && (
              <FormField
                control={form.control}
                name="saleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale</FormLabel>
                    <Select onValueChange={handleSaleChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a sale..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientUnpaidSales.length === 0 ? (
                          <div className="px-2 py-1 text-sm text-gray-500">No unpaid sales found</div>
                        ) : (
                          clientUnpaidSales.map((sale) => (
                            <SelectItem key={sale.id} value={sale.id}>
                              LPO: {sale.lpoNumber || "N/A"} - {CURRENCY} {parseFloat(sale.totalAmount).toLocaleString()}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Debit Card">Debit Card</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
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

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional notes about this payment..." 
                      {...field} 
                      value={field.value || ""}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sticky bottom-0 bg-background pt-4 -mx-6 px-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  form.reset();
                  setSelectedClientId("");
                  onOpenChange(false);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createPaymentMutation.isPending || !form.formState.isValid}
                className="w-full sm:w-auto"
              >
                {createPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </Form>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="p-6 max-h-[90vh] overflow-y-auto">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
}