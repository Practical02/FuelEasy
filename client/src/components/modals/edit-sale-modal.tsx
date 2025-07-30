import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { insertSaleSchema, type Client, type Sale } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { z } from "zod";

const editSaleFormSchema = insertSaleSchema.extend({
  quantityGallons: z.string().min(1, "Quantity is required"),
  salePricePerGallon: z.string().min(1, "Sale price is required"),
  vatPercentage: z.string().default("5.00"),
});

interface EditSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
}

export default function EditSaleModal({ open, onOpenChange, sale }: EditSaleModalProps) {
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
      quantityGallons: "",
      salePricePerGallon: "",
      lpoNumber: "",
      lpoDueDate: new Date(),
      vatPercentage: "5.00",
      saleStatus: "Pending LPO",
    },
  });

  // Set form values when sale changes
  useEffect(() => {
    if (sale) {
      form.reset({
        clientId: sale.clientId,
        saleDate: new Date(sale.saleDate),
        quantityGallons: sale.quantityGallons,
        salePricePerGallon: sale.salePricePerGallon,
        lpoNumber: sale.lpoNumber,
        lpoDueDate: new Date(sale.lpoDueDate),
        vatPercentage: sale.vatPercentage,
        saleStatus: sale.saleStatus,
      });
    }
  }, [sale, form]);

  const updateSaleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editSaleFormSchema>) => {
      if (!sale) throw new Error("No sale to update");
      
      const response = await apiRequest("PATCH", `/api/sales/${sale.id}`, {
        ...data,
        saleDate: new Date(data.saleDate).toISOString(),
        lpoDueDate: new Date(data.lpoDueDate).toISOString(),
        invoiceDate: data.saleStatus === "Invoiced" || data.saleStatus === "Paid" 
          ? new Date().toISOString() 
          : null,
      });
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
    const quantity = parseFloat(form.watch("quantityGallons") || "0");
    const pricePerGallon = parseFloat(form.watch("salePricePerGallon") || "0");
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

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sale - {sale.lpoNumber}</DialogTitle>
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
                      <Input placeholder="LPO-ABC-2025-001" {...field} />
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
                disabled={updateSaleMutation.isPending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {updateSaleMutation.isPending ? "Updating..." : "Update Sale"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}