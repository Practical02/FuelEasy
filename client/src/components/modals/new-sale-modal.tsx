import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertSaleSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY, VAT_PERCENTAGE } from "@/lib/constants";
import { z } from "zod";
import type { Client, Project } from "@shared/schema";

const saleFormSchema = insertSaleSchema.extend({
  projectId: z.string().min(1, "Project is required"),
  quantityGallons: z.coerce.number().min(0.01, "Quantity is required"),
  salePricePerGallon: z.coerce.number().min(0.001, "Price per gallon is required"),
  purchasePricePerGallon: z.coerce.number().min(0.001, "Purchase price is required"),
  deliveryNoteNumber: z.string().min(1, "Delivery Note no. is required"),
});

interface NewSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewSaleModal({ open, onOpenChange }: NewSaleModalProps) {
  const isMobile = useIsMobile();
  const [subtotal, setSubtotal] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const { toast } = useToast();

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<z.infer<typeof saleFormSchema>>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      clientId: "",
      projectId: "",
      saleDate: new Date(),
      quantityGallons: undefined,
      salePricePerGallon: undefined,
      purchasePricePerGallon: undefined,
      deliveryNoteNumber: "",
      saleStatus: "Pending LPO",
      vatPercentage: VAT_PERCENTAGE.toString(),
    },
  });

  const selectedClientId = form.watch("clientId");
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["projects", "by-client", selectedClientId],
    queryFn: () => apiRequest("GET", `/api/projects/by-client/${selectedClientId}`).then(res => res.json()),
    enabled: !!selectedClientId,
  });

  const rawDeliveryNote = form.watch("deliveryNoteNumber") ?? "";
  const [debouncedDeliveryNote, setDebouncedDeliveryNote] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedDeliveryNote(rawDeliveryNote.trim()), 400);
    return () => window.clearTimeout(t);
  }, [rawDeliveryNote]);

  const { data: deliveryNoteCheck } = useQuery({
    queryKey: ["/api/sales/check-delivery-note", debouncedDeliveryNote] as const,
    queryFn: async () => {
      const res = await fetch(
        `/api/sales/check-delivery-note?q=${encodeURIComponent(debouncedDeliveryNote)}`,
        { credentials: "include" },
      );
      if (!res.ok) return { taken: false as const };
      return res.json() as Promise<{ taken: boolean }>;
    },
    enabled: open && debouncedDeliveryNote.length > 0,
    staleTime: 15_000,
  });

  const deliveryNoteTaken = deliveryNoteCheck?.taken === true;

  const createSaleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof saleFormSchema>) => {
      const saleData: any = {
        ...data,
        deliveryNoteNumber: data.deliveryNoteNumber.trim(),
        saleDate: new Date(data.saleDate).toISOString(),
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(saleData),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body.message === "string" ? body.message : "Failed to create sale",
        );
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/current-level"] });
      toast({
        title: "Sale Recorded",
        description: "New sale has been recorded successfully.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Could not record sale",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const calculateTotals = () => {
    const quantity = form.watch("quantityGallons") || 0;
    const pricePerGallon = form.watch("salePricePerGallon") || 0;
    const vatPercentage = parseFloat(form.watch("vatPercentage") || "0");

    const sub = quantity * pricePerGallon;
    const vat = sub * (vatPercentage / 100);
    const total = sub + vat;

    setSubtotal(sub);
    setVatAmount(vat);
    setTotalAmount(total);
  };

  // Watch for changes in quantity, price, or VAT to recalculate
  const quantity = form.watch("quantityGallons");
  const price = form.watch("salePricePerGallon");
  const vatPercentage = form.watch("vatPercentage");

  useEffect(() => {
    calculateTotals();
  }, [quantity, price, vatPercentage, form]);

  // Auto-fill purchase price from FIFO when quantity changes
  useEffect(() => {
    if (!open || !quantity || quantity <= 0) return;
    let cancelled = false;
    fetch(`/api/stock/fifo-cost?quantity=${encodeURIComponent(quantity)}`, { credentials: "include" })
      .then((res) => {
        if (cancelled || !res.ok) return res.json().catch(() => ({}));
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.pricePerGallon != null) {
          form.setValue("purchasePricePerGallon", Number(data.pricePerGallon));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, quantity, form]);

  const onSubmit = (data: z.infer<typeof saleFormSchema>) => {
    createSaleMutation.mutate(data);
  };

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Record New Sale</DialogTitle>
        <DialogDescription>
          Record a new fuel sale transaction with a client.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("projectId", ""); // Reset project when client changes
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client..." />
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

              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedClientId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
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
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Date</FormLabel>
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
                name="deliveryNoteNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Note no. <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. DN-2025-001" {...field} value={field.value ?? ""} required />
                    </FormControl>
                    <FormMessage />
                    {deliveryNoteTaken && (
                      <Alert className="mt-2 border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100 dark:border-amber-600/50">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertTitle className="text-amber-900 dark:text-amber-100">Delivery note already in use</AlertTitle>
                        <AlertDescription>
                          Another sale is using this number (matching is case-insensitive). Use a different delivery note or you cannot save.
                        </AlertDescription>
                      </Alert>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="quantityGallons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (Gallons)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salePricePerGallon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price ({CURRENCY}/Gallon)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" placeholder="0.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="purchasePricePerGallon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price ({CURRENCY}/Gallon)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" placeholder="0.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>


            {/* Sale Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Sale Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{CURRENCY} {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT ({VAT_PERCENTAGE}%):</span>
                  <span className="font-medium">{CURRENCY} {vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between col-span-2 pt-3 border-t border-gray-200">
                  <span className="font-medium text-gray-900">Total Amount:</span>
                  <span className="font-bold text-lg text-primary-600">{CURRENCY} {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

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
                disabled={createSaleMutation.isPending || deliveryNoteTaken}
                className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
              >
                {createSaleMutation.isPending ? "Recording..." : "Record Sale"}
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
}
