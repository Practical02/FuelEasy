import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { salesKeys } from "@/lib/sales-query";
import { z } from "zod";

/** Minimal row for bulk pay (avoids circular import with invoices page). */
export type BulkPayInvoiceRow = {
  id: string;
  invoiceNumber: string;
  pendingAmount?: string;
};

const bulkPaySchema = z
  .object({
    paymentDate: z.coerce.date(),
    paymentMethod: z.enum(["Cheque", "Bank Transfer", "Cash"]),
    chequeNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "Cheque" && !data.chequeNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cheque number is required",
        path: ["chequeNumber"],
      });
    }
  });

type BulkPayForm = z.infer<typeof bulkPaySchema>;

interface BulkInvoicePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: BulkPayInvoiceRow[];
  /** Called after a successful payment (e.g. clear row selection). */
  onRecorded?: () => void;
}

export default function BulkInvoicePaymentModal({
  open,
  onOpenChange,
  invoices,
  onRecorded,
}: BulkInvoicePaymentModalProps) {
  const { toast } = useToast();

  const form = useForm<BulkPayForm>({
    resolver: zodResolver(bulkPaySchema),
    defaultValues: {
      paymentDate: new Date(),
      paymentMethod: "Cheque",
      chequeNumber: "",
    },
  });

  const paymentMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (open) {
      form.reset({
        paymentDate: new Date(),
        paymentMethod: "Cheque",
        chequeNumber: "",
      });
    }
  }, [open, form]);

  const totalPending = invoices.reduce(
    (s, inv) => s + parseFloat(inv.pendingAmount || "0"),
    0,
  );

  const mutation = useMutation({
    mutationFn: async (data: BulkPayForm) => {
      const res = await fetch("/api/invoices/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          invoiceIds: invoices.map((i) => i.id),
          paymentDate: data.paymentDate.toISOString(),
          paymentMethod: data.paymentMethod,
          chequeNumber: data.chequeNumber?.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.message === "string" ? body.message : "Payment failed");
      }
      return body as { totalAmount: string; paymentsCreated: number };
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }),
        queryClient.invalidateQueries({ queryKey: salesKeys.root }),
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] }),
      ]);
      toast({
        title: "Payment recorded",
        description: `${CURRENCY} ${parseFloat(data.totalAmount).toLocaleString()} recorded for ${invoices.length} invoice(s). Cashbook entry includes invoice breakdown.`,
      });
      onRecorded?.();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Could not record payment",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record payment for selected invoices</DialogTitle>
          <DialogDescription>
            One receipt (e.g. single cheque) covering all selected invoices. All must be for the{" "}
            <strong>same client</strong>. Linked sales are marked paid and one cashbook inflow is created with
            invoice details in the description.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2 max-h-40 overflow-y-auto">
          {invoices.map((inv) => {
            const pending = parseFloat(inv.pendingAmount || "0");
            return (
              <div key={inv.id} className="flex justify-between gap-2">
                <span className="font-medium truncate">{inv.invoiceNumber}</span>
                <span className="text-muted-foreground shrink-0">
                  {CURRENCY} {pending.toLocaleString()}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between pt-2 border-t font-semibold">
            <span>Total</span>
            <span>
              {CURRENCY} {totalPending.toLocaleString()}
            </span>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={
                        field.value instanceof Date
                          ? field.value.toISOString().slice(0, 10)
                          : ""
                      }
                      onChange={(e) => field.onChange(new Date(e.target.value + "T12:00:00"))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {paymentMethod === "Cheque" && (
              <FormField
                control={form.control}
                name="chequeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cheque number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CHQ-123456" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || invoices.length === 0}>
                {mutation.isPending ? "Saving…" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
