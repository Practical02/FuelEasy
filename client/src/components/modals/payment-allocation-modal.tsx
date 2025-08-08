import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2 } from "lucide-react";

const allocationSchema = z.object({
  cashbookEntryId: z.string().min(1, "Cashbook entry is required"),
  allocations: z.array(z.object({
    invoiceId: z.string().min(1, "Invoice is required"),
    amountAllocated: z.string().min(1, "Amount is required").refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      "Amount must be a positive number"
    ),
  })).min(1, "At least one allocation is required"),
});

type AllocationFormData = z.infer<typeof allocationSchema>;

interface PaymentAllocationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cashbookEntryId?: string;
  totalAmount?: number;
  accountHeadId?: string;
  onSuccess?: () => void;
}

export function PaymentAllocationModal({
  isOpen,
  onOpenChange,
  cashbookEntryId,
  totalAmount = 0,
  accountHeadId,
  onSuccess
}: PaymentAllocationModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending invoices for allocation (filtered by client if accountHeadId is provided)
  const { data: pendingInvoices = [], isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ["/api/cashbook/pending-invoices", accountHeadId],
    queryFn: async () => {
      const url = accountHeadId 
        ? `/api/cashbook/pending-invoices?accountHeadId=${accountHeadId}`
        : "/api/cashbook/pending-invoices";
      const response = await apiRequest("GET", url);
      return response.json();
    },
    enabled: !!accountHeadId, // Only fetch if we have an account head
  });

  const form = useForm<AllocationFormData>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      cashbookEntryId: cashbookEntryId || "",
      allocations: [{ invoiceId: "", amountAllocated: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "allocations",
  });

  // Calculate total allocated amount
  const totalAllocated = form.watch("allocations").reduce(
    (sum, allocation) => sum + (parseFloat(allocation.amountAllocated) || 0),
    0
  );

  const remainingAmount = totalAmount - totalAllocated;
  const isOverAllocated = remainingAmount < -0.01;

  // Get all selected invoice IDs to prevent duplicates
  const selectedInvoiceIds = form.watch("allocations")
    .map(allocation => allocation.invoiceId)
    .filter(id => id !== "");

  // Check for over-allocations (only if amount exceeds pending amount)
  const hasOverAllocations = form.watch("allocations").some(allocation => {
    const selectedInvoice = pendingInvoices.find(inv => inv.id === allocation.invoiceId);
    if (!selectedInvoice) {
      return false;
    }
    
    const pendingAmount = (selectedInvoice.pendingAmount || parseFloat(selectedInvoice.totalAmount)) || 0;
    const allocatedAmount = parseFloat(allocation.amountAllocated) || 0;
    
    return allocatedAmount > pendingAmount;
  });

  const createAllocationMutation = useMutation({
    mutationFn: async (data: AllocationFormData) => {
      // Create allocations one by one to handle errors properly
      const results = [];
      for (const allocation of data.allocations) {
        const response = await apiRequest("POST", "/api/cashbook/payment-allocations", {
          cashbookEntryId: data.cashbookEntryId,
          invoiceId: allocation.invoiceId,
          amountAllocated: allocation.amountAllocated,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create allocation");
        }
        
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook/payment-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
      toast({
        title: "Payment allocations created",
        description: "Payment has been allocated to invoices successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Allocation Error",
        description: error?.message || "Failed to create payment allocations. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AllocationFormData) => {
    // Check if total allocated amount exceeds payment amount
    if (isOverAllocated) {
      toast({
        title: "Amount mismatch",
        description: `Total allocated amount (AED ${totalAllocated.toFixed(2)}) cannot exceed total payment amount (AED ${totalAmount.toFixed(2)})`,
        variant: "destructive",
      });
      return;
    }

    // Check if any allocation exceeds the pending amount for that invoice
    const overAllocatedInvoices = data.allocations.filter(allocation => {
      const selectedInvoice = pendingInvoices.find(inv => inv.id === allocation.invoiceId);
      if (!selectedInvoice) {
        return false;
      }
      
      const pendingAmount = (selectedInvoice.pendingAmount || parseFloat(selectedInvoice.totalAmount)) || 0;
      const allocatedAmount = parseFloat(allocation.amountAllocated) || 0;
      
      return allocatedAmount > pendingAmount;
    });

    if (overAllocatedInvoices.length > 0) {
      const overAllocatedInvoice = overAllocatedInvoices[0];
      const selectedInvoice = pendingInvoices.find(inv => inv.id === overAllocatedInvoice.invoiceId);
      const pendingAmount = selectedInvoice?.pendingAmount || 0;
      
      toast({
        title: "Over-allocation detected",
        description: `Cannot allocate more than the pending amount (AED ${(pendingAmount || 0).toFixed(2)}) for invoice ${selectedInvoice?.invoiceNumber}`,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate invoice selections
    const invoiceIds = data.allocations.map(a => a.invoiceId).filter(id => id !== "");
    const uniqueInvoiceIds = new Set(invoiceIds);
    if (invoiceIds.length !== uniqueInvoiceIds.size) {
      toast({
        title: "Duplicate invoice detected",
        description: "Each invoice can only be allocated once per payment.",
        variant: "destructive",
      });
      return;
    }

    createAllocationMutation.mutate(data);
  };

  const addAllocation = () => {
    append({ invoiceId: "", amountAllocated: "" });
  };

  const handleInvoiceChange = (index: number, invoiceId: string) => {
    const selectedInvoice = pendingInvoices.find(inv => inv.id === invoiceId);
    if (selectedInvoice) {
      const pendingAmount = (selectedInvoice.pendingAmount || parseFloat(selectedInvoice.totalAmount)) || 0;
      form.setValue(`allocations.${index}.amountAllocated`, pendingAmount.toFixed(2));
    }
  };

  const removeAllocation = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  useEffect(() => {
    if (cashbookEntryId) {
      form.setValue("cashbookEntryId", cashbookEntryId);
    }
  }, [cashbookEntryId, form]);

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Allocate Payment to Invoices</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Total Payment Amount:</span>
                  <span className="ml-2 text-green-600">AED {totalAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium">Allocated Amount:</span>
                  <span className="ml-2 text-blue-600">AED {totalAllocated.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium">Remaining to Allocate:</span>
                  <span className={`ml-2 ${remainingAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    AED {remainingAmount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${remainingAmount === 0 ? 'text-green-600' : remainingAmount > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {remainingAmount === 0 ? 'Fully Allocated' : remainingAmount > 0 ? 'Partially Allocated' : 'Over-allocated'}
                  </span>
                </div>
                {isOverAllocated && (
                  <div className="col-span-2">
                    <span className="text-red-600 text-sm">
                      ⚠️ Total allocation exceeds payment amount by AED {Math.abs(remainingAmount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardHeader>
                      <CardTitle className="text-sm flex justify-between items-center">
                        Invoice Allocation {index + 1}
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeAllocation(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`allocations.${index}.invoiceId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Invoice</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handleInvoiceChange(index, value);
                                }} 
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select invoice" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {pendingInvoices
                                    .filter((invoice) => {
                                      // Show current selection or invoices not yet selected
                                      return field.value === invoice.id || !selectedInvoiceIds.includes(invoice.id);
                                    })
                                    .map((invoice) => {
                                      const pendingAmount = (invoice.pendingAmount || parseFloat(invoice.totalAmount)) || 0;
                                      const allocatedAmount = parseFloat(invoice.allocatedAmount) || 0;
                                      const isFullyPaid = pendingAmount <= 0.01; // Allow for small rounding differences
                                      const isAlreadySelected = selectedInvoiceIds.includes(invoice.id) && field.value !== invoice.id;
                                      
                                      return (
                                        <SelectItem 
                                          key={invoice.id} 
                                          value={invoice.id}
                                          disabled={isFullyPaid || isAlreadySelected}
                                          className={(isFullyPaid || isAlreadySelected) ? "opacity-50 cursor-not-allowed" : ""}
                                        >
                                          <div className="flex flex-col">
                                            <span>
                                              {invoice.invoiceNumber} - {invoice.sale?.client?.name}
                                              {isAlreadySelected && " (Already Selected)"}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              Total: AED {invoice.totalAmount} | 
                                              {allocatedAmount > 0 ? ` Paid: AED ${(allocatedAmount || 0).toFixed(2)} |` : ""}
                                              Pending: AED {(pendingAmount || 0).toFixed(2)}
                                              {isFullyPaid && " (Fully Paid)"}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                                                 <FormField
                           control={form.control}
                           name={`allocations.${index}.amountAllocated`}
                           render={({ field }) => {
                             const selectedInvoiceId = form.watch(`allocations.${index}.invoiceId`);
                             const selectedInvoice = pendingInvoices.find(inv => inv.id === selectedInvoiceId);
                             const pendingAmount = (selectedInvoice?.pendingAmount || 0);
                             const allocatedAmount = parseFloat(field.value) || 0;
                             const isOverAllocated = allocatedAmount > pendingAmount && allocatedAmount > 0;
                             
                             return (
                               <FormItem>
                                 <FormLabel>Amount (AED)</FormLabel>
                                 <FormControl>
                                   <Input
                                     type="number"
                                     step="0.01"
                                     placeholder="0.00"
                                     {...field}
                                     className={isOverAllocated ? "border-red-500" : ""}
                                   />
                                 </FormControl>
                                 {selectedInvoice && (
                                   <div className="text-xs text-muted-foreground">
                                     Pending amount: AED {(pendingAmount || 0).toFixed(2)}
                                     {allocatedAmount > 0 && (
                                       <span className="ml-2">
                                         | Allocating: AED {allocatedAmount.toFixed(2)}
                                       </span>
                                     )}
                                   </div>
                                 )}
                                 {isOverAllocated && (
                                   <div className="text-xs text-red-500">
                                     Cannot allocate more than pending amount
                                   </div>
                                 )}
                                 <FormMessage />
                               </FormItem>
                             );
                           }}
                         />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addAllocation}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Invoice
              </Button>

              <div className="sticky bottom-0 bg-background pt-4 -mx-6 px-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
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
                  disabled={createAllocationMutation.isPending || isOverAllocated || hasOverAllocations}
                  className="w-full sm:w-auto"
                >
                  {createAllocationMutation.isPending ? "Creating..." : "Create Allocations"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="p-6 max-h-[90vh] overflow-y-auto">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
} 