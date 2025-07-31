import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertStockSchema, type Stock } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { z } from "zod";

const stockFormSchema = insertStockSchema.omit({
  vatAmount: true,
  totalCost: true,
}).extend({
  quantityGallons: z.string().min(1, "Quantity is required"),
  purchasePricePerGallon: z.string().min(1, "Purchase price is required"),
  vatPercentage: z.string().default("5.00"),
});

interface EditStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: Stock | null;
}

export default function EditStockModal({ open, onOpenChange, stock }: EditStockModalProps) {
  const [subtotal, setSubtotal] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof stockFormSchema>>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      purchaseDate: new Date(),
      quantityGallons: "",
      purchasePricePerGallon: "",
      vatPercentage: "5.00",
    },
  });

  // Set form values when stock changes
  useEffect(() => {
    if (stock) {
      form.reset({
        purchaseDate: new Date(stock.purchaseDate),
        quantityGallons: stock.quantityGallons,
        purchasePricePerGallon: stock.purchasePricePerGallon,
        vatPercentage: stock.vatPercentage,
      });
    }
  }, [stock, form]);

  const updateStockMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockFormSchema>) => {
      if (!stock) throw new Error("No stock to update");
      
      // Calculate VAT and total cost
      const quantity = parseFloat(data.quantityGallons);
      const pricePerGallon = parseFloat(data.purchasePricePerGallon);
      const vatPercentage = parseFloat(data.vatPercentage || "5.00");
      
      const subtotal = quantity * pricePerGallon;
      const vatAmount = subtotal * (vatPercentage / 100);
      const totalCost = subtotal + vatAmount;

      const response = await apiRequest("PUT", `/api/stock/${stock.id}`, {
        ...data,
        purchaseDate: new Date(data.purchaseDate).toISOString(),
        vatAmount: vatAmount.toFixed(2),
        totalCost: totalCost.toFixed(2),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/current-level"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      toast({
        title: "Stock Updated",
        description: "Stock entry has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update stock. Please try again.",
        variant: "destructive",
      });
    },
  });

  const calculateTotals = () => {
    const quantity = parseFloat(form.watch("quantityGallons") || "0");
    const pricePerGallon = parseFloat(form.watch("purchasePricePerGallon") || "0");
    const vatPercentage = parseFloat(form.watch("vatPercentage") || "0");

    const sub = quantity * pricePerGallon;
    const vat = sub * (vatPercentage / 100);
    const total = sub + vat;

    setSubtotal(sub);
    setVatAmount(vat);
    setTotalCost(total);
  };

  // Watch for changes in quantity, price, or VAT to recalculate
  const quantity = form.watch("quantityGallons");
  const price = form.watch("purchasePricePerGallon");
  const vatPercentage = form.watch("vatPercentage");

  useEffect(() => {
    calculateTotals();
  }, [quantity, price, vatPercentage]);

  const onSubmit = (data: z.infer<typeof stockFormSchema>) => {
    updateStockMutation.mutate(data);
  };

  if (!stock) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Stock Entry</DialogTitle>
          <DialogDescription>
            Update the details of this diesel fuel stock purchase.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
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
              name="purchasePricePerGallon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Price per Gallon ({CURRENCY})</FormLabel>
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

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">
                    {CURRENCY} {subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">VAT ({vatPercentage}%):</span>
                  <span className="font-medium">
                    {CURRENCY} {vatAmount.toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="font-bold text-lg text-gray-900">
                    {CURRENCY} {totalCost.toFixed(2)}
                  </span>
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
                disabled={updateStockMutation.isPending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {updateStockMutation.isPending ? "Updating..." : "Update Stock"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}