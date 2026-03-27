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
import { salesKeys, salesListFromResponse, salesStatusUrl } from "@/lib/sales-query";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { z } from "zod";

const SUPPLIER_OPTIONS = [
  { value: "zigma", label: "Zigma" },
  { value: "sayan", label: "Sayan" },
] as const;

const invoiceFormSchema = z.object({
  supplier: z.enum(["zigma", "sayan"]).default("zigma"),
  lpoNumber: z.string().min(1, "LPO number is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.date(),
  /** When set, invoice is Sent and payment due is one month from this date. */
  submissionDate: z.date().optional(),
});

interface NewInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Combine settings prefix with LPO (prefix often ends with `-`, e.g. ZDT/S20-). */
function suggestedInvoiceNumber(prefix: string | undefined, lpo: string) {
  const p = (prefix ?? "ZDT/S20-").trim();
  const l = (lpo ?? "").trim();
  if (!l) return p;
  if (!p) return l;
  if (p.endsWith("-") || p.endsWith("/")) return `${p}${l}`;
  return `${p}-${l}`;
}

export default function NewInvoiceModal({ open, onOpenChange }: NewInvoiceModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const { data: businessSettings } = useQuery({
    queryKey: ["/api/business-settings"],
    queryFn: async () => (await apiRequest("GET", "/api/business-settings")).json(),
    enabled: open,
  });

  const { data: salesResponse } = useQuery({
    queryKey: salesKeys.status("LPO Received"),
    queryFn: async () =>
      (await apiRequest("GET", salesStatusUrl("LPO Received"))).json(),
    enabled: open,
  });
  const sales: SaleWithClient[] = salesListFromResponse(salesResponse) as SaleWithClient[];

  const form = useForm<z.infer<typeof invoiceFormSchema>>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      supplier: "zigma",
      lpoNumber: "",
      invoiceNumber: "",
      invoiceDate: new Date(),
      submissionDate: undefined,
    },
  });

  const supplier = form.watch("supplier");
  const selectedLpo = form.watch("lpoNumber");
  const supplierPrefix = useMemo(() => {
    if (supplier === "zigma") {
      return (
        (businessSettings?.zigmaInvoicePrefix as string | undefined) ||
        (businessSettings?.invoicePrefix as string | undefined) ||
        "ZDT-"
      );
    }
    return (
      (businessSettings?.sayanInvoicePrefix as string | undefined) ||
      (businessSettings?.invoicePrefix as string | undefined) ||
      "SYN-"
    );
  }, [supplier, businessSettings]);

  useEffect(() => {
    if (selectedLpo) {
      form.setValue("invoiceNumber", suggestedInvoiceNumber(supplierPrefix, selectedLpo));
    }
  }, [selectedLpo, supplierPrefix, form]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof invoiceFormSchema>) => {
      const payload: Record<string, unknown> = {
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        supplier: data.supplier,
      };
      if (data.submissionDate) {
        payload.submissionDate = data.submissionDate;
      }
      payload.lpoNumber = data.lpoNumber;
      const response = await apiRequest("POST", "/api/invoices/by-lpo", payload);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create invoice");
      }
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }),
        queryClient.invalidateQueries({ queryKey: salesKeys.root }),
        queryClient.invalidateQueries({ queryKey: salesKeys.status("LPO Received") }),
      ]);
      await queryClient.refetchQueries({ queryKey: salesKeys.status("LPO Received"), type: "active" });
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
  const lpoSummary = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const sale of invoiceableSales) {
      const lpo = (sale.lpoNumber || "").trim();
      if (!lpo) continue;
      const existing = map.get(lpo) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += parseFloat(sale.totalAmount);
      map.set(lpo, existing);
    }
    return map;
  }, [invoiceableSales]);
  const selectedLpoSummary = selectedLpo ? lpoSummary.get(selectedLpo) : undefined;

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Create New Invoice</DialogTitle>
        <DialogDescription>
          Create a draft invoice (Generated), or set the date you sent it to the client to mark it Sent and set payment due from that date. Record payment from the Invoices list when the client pays—status becomes Paid when the invoice is fully covered.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUPPLIER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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

            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., ZDT/S20-12345"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Suggested from Settings → Invoice prefix and LPO. Edit the full number anytime (prefix can change per invoice).
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedLpoSummary && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Total LPO Amount ({selectedLpoSummary.count} sale{selectedLpoSummary.count !== 1 ? "s" : ""})
                  </span>
                  <span className="font-semibold">
                    {CURRENCY} {selectedLpoSummary.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

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

            <FormField
              control={form.control}
              name="submissionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date sent to client (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ""}
                      onChange={(e) =>
                        field.onChange(e.target.value ? new Date(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    If set, the invoice is marked <strong>Sent</strong> and payment due is one month from this date. Leave empty to keep it <strong>Generated</strong> (draft); due date then follows invoice date.
                  </p>
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
