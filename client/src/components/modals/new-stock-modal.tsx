import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertStockSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { z } from "zod";

const stockFormSchema = insertStockSchema.extend({
  quantityGallons: z.string().min(1, "Quantity is required"),
  purchasePricePerGallon: z.string().min(1, "Purchase price is required"),
});

interface NewStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewStockModal({ open, onOpenChange }: NewStockModalProps) {
  const [totalCost, setTotalCost] = useState(0);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof stockFormSchema>>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      purchaseDate: new Date(),
      quantityGallons: "",
      purchasePricePerGallon: "",
    },
  });

  const createStockMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockFormSchema>) => {
      const response = await apiRequest("POST", "/api/stock", {
        ...data,
        purchaseDate: new Date(data.purchaseDate).toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/current-level"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      toast({
        title: "Stock Added",
        description: "New stock entry has been added successfully.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add stock. Please try again.",
        variant: "destructive",
      });
    },
  });

  const calculateTotal = () => {
    const quantity = parseFloat(form.watch("quantityGallons") || "0");
    const pricePerGallon = parseFloat(form.watch("purchasePricePerGallon") || "0");
    setTotalCost(quantity * pricePerGallon);
  };

  // Watch for changes in quantity or price to recalculate
  const quantity = form.watch("quantityGallons");
  const price = form.watch("purchasePricePerGallon");

  useEffect(() => {
    calculateTotal();
  }, [quantity, price]);

  const onSubmit = (data: z.infer<typeof stockFormSchema>) => {
    createStockMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Stock</DialogTitle>
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

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-bold text-lg text-gray-900">
                  {CURRENCY} {totalCost.toFixed(2)}
                </span>
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
                disabled={createStockMutation.isPending}
                className="primary-500 text-white hover:primary-600"
              >
                {createStockMutation.isPending ? "Adding..." : "Add Stock"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
