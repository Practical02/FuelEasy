import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertInvoiceSchema, SaleWithClient } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const invoiceFormSchema = insertInvoiceSchema.extend({
  saleId: z.string().min(1, "Sale is required"),
});

interface NewInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewInvoiceModal({ open, onOpenChange }: NewInvoiceModalProps) {
  const { toast } = useToast();

  const { data: salesResponse } = useQuery<any>({
    queryKey: ["/api/sales"],
  });
  const sales: SaleWithClient[] = Array.isArray(salesResponse)
    ? (salesResponse as SaleWithClient[])
    : (salesResponse?.data ?? []);

  const form = useForm<z.infer<typeof invoiceFormSchema>>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      saleId: "",
      invoiceNumber: "",
      invoiceDate: new Date(),
      totalAmount: "0",
      vatAmount: "0",
      status: "Generated",
    },
  });

  const selectedSaleId = form.watch("saleId");

  useEffect(() => {
    if (selectedSaleId) {
      const sale = sales?.find(s => s.id === selectedSaleId);
      if (sale) {
        form.setValue("totalAmount", sale.totalAmount);
        form.setValue("vatAmount", sale.vatAmount);
        form.setValue("invoiceNumber", `INV-${sale.lpoNumber}`);
      }
    }
  }, [selectedSaleId, sales, form]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof invoiceFormSchema>) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Invoice Created",
        description: "New invoice has been created successfully.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof invoiceFormSchema>) => {
    createInvoiceMutation.mutate(data);
  };

  const invoiceableSales = sales?.filter(sale =>
    sale.saleStatus === "LPO Received"
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>
            Manually create a new invoice for a sale.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="saleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale (LPO Received)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sale..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {invoiceableSales.map((sale) => (
                        <SelectItem key={sale.id} value={sale.id}>
                          {sale.client.name} - LPO: {sale.lpoNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., INV-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invoiceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createInvoiceMutation.isPending}
              >
                {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
