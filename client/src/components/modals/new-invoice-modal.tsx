import { useEffect, useMemo } from "react";
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
import { insertInvoiceSchema, SaleWithClient } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const invoiceFormSchema = z.object({
  mode: z.enum(["single", "lpo"]).default("lpo"),
  saleId: z.string().optional(),
  lpoNumber: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.date(),
});

interface NewInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewInvoiceModal({ open, onOpenChange }: NewInvoiceModalProps) {
  const isMobile = useIsMobile();
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
      mode: "lpo",
      saleId: "",
      lpoNumber: "",
      invoiceNumber: "",
      invoiceDate: new Date(),
    },
  });

  const mode = form.watch("mode");
  const selectedSaleId = form.watch("saleId");
  const selectedLpo = form.watch("lpoNumber");

  useEffect(() => {
    if (mode === "single" && selectedSaleId) {
      const sale = sales?.find(s => s.id === selectedSaleId);
      if (sale) {
        form.setValue("invoiceNumber", `INV-${sale.lpoNumber || ""}`);
      }
    } else if (mode === "lpo" && selectedLpo) {
      form.setValue("invoiceNumber", `INV-${selectedLpo}`);
    }
  }, [mode, selectedSaleId, selectedLpo, sales, form]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof invoiceFormSchema>) => {
      const payload: any = {
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
      };
      let url = "/api/invoices";
      if (data.mode === "single") {
        payload.saleId = data.saleId;
        const sale = sales.find(s => s.id === data.saleId);
        if (!sale) throw new Error("Selected sale not found");
        payload.totalAmount = sale.totalAmount;
        payload.vatAmount = sale.vatAmount;
        payload.status = "Generated";
      } else {
        url = "/api/invoices/by-lpo";
        payload.lpoNumber = data.lpoNumber;
      }
      const response = await apiRequest("POST", url, payload);
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

  const invoiceableSales = useMemo(() => (sales?.filter(sale => sale.saleStatus === "LPO Received") || []), [sales]);
  const lpoOptions = useMemo(() => {
    const set = new Set<string>();
    invoiceableSales.forEach(s => s.lpoNumber && set.add(s.lpoNumber));
    return Array.from(set);
  }, [invoiceableSales]);

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Create New Invoice</DialogTitle>
        <DialogDescription>
          Create an invoice for a single sale or for all sales under an LPO.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lpo">By LPO (multiple sales)</SelectItem>
                      <SelectItem value="single">Single Sale</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "single" ? (
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
            ) : (
              <FormField
                control={form.control}
                name="lpoNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LPO Number</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an LPO..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lpoOptions.map((lpo) => (
                          <SelectItem key={lpo} value={lpo}>
                            {lpo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            <div className="sticky bottom-0 bg-background pt-4 -mx-6 px-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createInvoiceMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
}
