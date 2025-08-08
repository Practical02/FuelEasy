import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { insertSaleSchema, type Client, type Sale, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { z } from "zod";

const editSaleFormSchema = insertSaleSchema.extend({
  quantityGallons: z.coerce.number().min(0.01, "Quantity is required"),
  salePricePerGallon: z.coerce.number().min(0.001, "Sale price is required"),
  purchasePricePerGallon: z.coerce.number().min(0.001, "Purchase price is required"),
  vatPercentage: z.string().default("5.00"),
});

interface EditSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
}

export default function EditSaleModal({ open, onOpenChange, sale }: EditSaleModalProps) {
  const isMobile = useIsMobile();
  const [subtotal, setSubtotal] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<z.infer<typeof editSaleFormSchema>>({
    resolver: zodResolver(editSaleFormSchema),
    defaultValues: {
      clientId: "",
      saleDate: new Date(),
      quantityGallons: undefined,
      salePricePerGallon: undefined,
      purchasePricePerGallon: undefined,
      lpoNumber: "",
      lpoDueDate: new Date(),
      vatPercentage: "5.00",
      saleStatus: "Pending LPO",
    },
  });

  const selectedClientId = form.watch("clientId");
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects", "by-client", selectedClientId],
    queryFn: () => apiRequest("GET", `/api/projects/by-client/${selectedClientId}`).then(res => res.json()),
    enabled: !!selectedClientId,
  });

  // Set form values when sale changes
  useEffect(() => {
    if (sale) {
      form.reset({
        clientId: sale.clientId,
        projectId: sale.projectId,
        saleDate: new Date(sale.saleDate),
        quantityGallons: parseFloat(sale.quantityGallons),
        salePricePerGallon: parseFloat(sale.salePricePerGallon),
        purchasePricePerGallon: sale.purchasePricePerGallon ? parseFloat(sale.purchasePricePerGallon) : undefined,
        lpoNumber: sale.lpoNumber || "",
        lpoDueDate: sale.lpoDueDate ? new Date(sale.lpoDueDate) : new Date(),
        vatPercentage: sale.vatPercentage,
        saleStatus: sale.saleStatus,
      });
    }
  }, [sale, form]);

  // Automatically update saleStatus to "LPO Received" if LPO Number is entered
  useEffect(() => {
    const currentLpoNumber = form.watch("lpoNumber");
    const currentSaleStatus = form.watch("saleStatus");

    if (currentLpoNumber && currentLpoNumber.trim() !== "" && currentSaleStatus === "Pending LPO") {
      form.setValue("saleStatus", "LPO Received");
    }
  }, [form.watch("lpoNumber"), form.watch("saleStatus"), form]);

  const updateSaleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editSaleFormSchema>) => {
      if (!sale) {
        throw new Error("No sale to update");
      }
      
      const { lpoDueDate, ...rest } = data;
      const saleData: any = {
        ...rest,
        saleDate: new Date(data.saleDate).toISOString(),
        invoiceDate: data.saleStatus === "Invoiced" || data.saleStatus === "Paid" 
          ? new Date().toISOString() 
          : null,
      };

      if (lpoDueDate) {
        saleData.lpoDueDate = new Date(lpoDueDate).toISOString();
      }

      const response = await apiRequest("PATCH", `/api/sales/${sale.id}`, saleData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      toast({
        title: "Sale Updated",
        description: "Sale has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sale. Please try again.",
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
  }, [quantity, price, vatPercentage]);

  const onSubmit = (data: z.infer<typeof editSaleFormSchema>) => {
    updateSaleMutation.mutate(data);
  };

  if (!sale) {
    return null;
  }

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Edit Sale - {sale.lpoNumber}</DialogTitle>
        <DialogDescription>
          Edit the details of this fuel sale transaction.
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="LPO-ABC-2025-001" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lpoDueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LPO Due Date</FormLabel>
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
                    <FormLabel>Sale Price per Gallon ({CURRENCY})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" placeholder="0.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchasePricePerGallon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price per Gallon ({CURRENCY})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vatPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Percentage (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="5.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="saleStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Pending LPO">Pending LPO</SelectItem>
                        <SelectItem value="LPO Received">LPO Received</SelectItem>
                        <SelectItem value="Invoiced">Invoiced</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sale Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium">{quantity || 0} gallons</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Price per Gallon:</span>
                  <span className="font-medium">{CURRENCY} {price || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{CURRENCY} {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">VAT ({vatPercentage}%):</span>
                  <span className="font-medium">{CURRENCY} {vatAmount.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-bold text-lg text-gray-900">{CURRENCY} {totalAmount.toFixed(2)}</span>
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
                disabled={updateSaleMutation.isPending}
                className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
              >
                {updateSaleMutation.isPending ? "Updating..." : "Update Sale"}
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
