import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const allocationSchema = z.object({
  cashbookEntryId: z.string().min(1),
  stockId: z.string().min(1),
  amountAllocated: z.string().min(1),
});

interface SupplierAdvanceAllocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCashbookEntryId?: string;
  onSuccess?: () => void;
}

export default function SupplierAdvanceAllocationModal({ open, onOpenChange, defaultCashbookEntryId, onSuccess }: SupplierAdvanceAllocationModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const { data: advances = [] } = useQuery<any[]>({ queryKey: ["/api/cashbook/supplier-advances"] });
  const { data: stocks = [] } = useQuery<any[]>({ queryKey: ["/api/stock"] });

  const form = useForm<z.infer<typeof allocationSchema>>({
    resolver: zodResolver(allocationSchema),
    defaultValues: { cashbookEntryId: "", stockId: "", amountAllocated: "" }
  });

  // Prefill default cashbook entry id if provided
  if (defaultCashbookEntryId && form.getValues("cashbookEntryId") !== defaultCashbookEntryId) {
    form.setValue("cashbookEntryId", defaultCashbookEntryId);
  }

  const selectedAdvance = useMemo(() => advances.find((a: any) => a.entry?.id === form.watch("cashbookEntryId")), [advances, form]);

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof allocationSchema>) => {
      const res = await fetch("/api/cashbook/supplier-advance-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Failed to allocate advance");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Allocated", description: "Supplier advance allocated successfully" });
      if (onSuccess) onSuccess();
      form.reset();
      onOpenChange(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed", variant: "destructive" }),
  });

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Allocate Supplier Advance</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-4">
          <FormField
            control={form.control}
            name="cashbookEntryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Advance Entry</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier advance..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {advances.map((a: any) => (
                      <SelectItem key={a.entry.id} value={a.entry.id}>
                        {a.entry.counterparty || a.entry.accountHead?.name} — Rem: {a.remainingAmount.toFixed(2)}
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
            name="stockId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Purchase</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stock purchase..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stocks.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {new Date(s.purchaseDate).toLocaleDateString()} — {parseFloat(s.totalCost).toFixed(2)}
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
            name="amountAllocated"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount to Allocate</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedAdvance && (
            <div className="text-sm text-gray-600">Remaining in advance: {selectedAdvance.remainingAmount.toFixed(2)}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Allocating..." : "Allocate"}</Button>
          </div>
        </form>
      </Form>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="p-6 max-h-[90vh] overflow-y-auto">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">{body}</DialogContent>
    </Dialog>
  );
}


