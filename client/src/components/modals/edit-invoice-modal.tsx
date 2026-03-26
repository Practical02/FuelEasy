import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { InsertInvoice, Invoice } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY } from "@/lib/constants";
import { salesKeys } from "@/lib/sales-query";
import { z } from "zod";

/** List row shape includes joined `sale` and `pendingAmount`; core invoice fields drive the form. */
export type InvoiceEditContext = Invoice & {
  sale?: {
    client?: { name?: string } | null;
    project?: { name?: string | null } | null;
  } | null;
  pendingAmount?: string;
};

/** Only fields we edit — full `insertInvoiceSchema` fails validation when reset from API (date/decimal shapes, id/createdAt). */
const editInvoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.coerce.date(),
  submissionDate: z.union([z.coerce.date(), z.null()]).optional(),
});

interface EditInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceEditContext | null;
}

export default function EditInvoiceModal({ open, onOpenChange, invoice }: EditInvoiceModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof editInvoiceFormSchema>>({
    resolver: zodResolver(editInvoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      invoiceDate: new Date(),
      submissionDate: undefined,
    },
  });

  useEffect(() => {
    if (invoice) {
      form.reset({
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: new Date(invoice.invoiceDate),
        submissionDate: invoice.submissionDate ? new Date(invoice.submissionDate) : undefined,
      });
    }
  }, [invoice, form]);

  const updateInvoiceMutation = useMutation({
    mutationFn: async (payload: InsertInvoice) => {
      if (!invoice) {
        throw new Error("No invoice to update");
      }
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...payload,
          invoiceDate: payload.invoiceDate instanceof Date ? payload.invoiceDate.toISOString() : payload.invoiceDate,
          submissionDate:
            payload.submissionDate === null || payload.submissionDate === undefined
              ? payload.submissionDate
              : payload.submissionDate instanceof Date
                ? payload.submissionDate.toISOString()
                : payload.submissionDate,
          dueDate:
            payload.dueDate === null || payload.dueDate === undefined
              ? payload.dueDate
              : payload.dueDate instanceof Date
                ? payload.dueDate.toISOString()
                : payload.dueDate,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error
              : "Failed to update invoice";
        throw new Error(msg);
      }
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }),
        queryClient.invalidateQueries({ queryKey: salesKeys.root }),
      ]);
      toast({
        title: "Invoice Updated",
        description: "Invoice has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof editInvoiceFormSchema>) => {
    if (!invoice) return;
    const submissionDate =
      data.submissionDate === null
        ? null
        : data.submissionDate !== undefined
          ? data.submissionDate
          : invoice.submissionDate ?? null;

    const payload: InsertInvoice = {
      saleId: invoice.saleId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      submissionDate,
      dueDate: invoice.dueDate ?? null,
      lpoNumber: invoice.lpoNumber ?? null,
      totalAmount: String(invoice.totalAmount),
      vatAmount: String(invoice.vatAmount),
      status:
        invoice.status === "Paid"
          ? "Paid"
          : submissionDate
            ? "Sent"
            : "Generated",
    };
    updateInvoiceMutation.mutate(payload);
  };

  const show = open && !!invoice;
  const inv = invoice;

  const body = inv ? (
    <>
      <DialogHeader>
        <DialogTitle>Edit Invoice</DialogTitle>
        <DialogDescription>
          Status follows the workflow: <strong>Generated</strong> until you set a submission date, then <strong>Sent</strong>. Clearing the submission date returns it to Generated (unless already <strong>Paid</strong>). Paid is set when payments fully cover the invoice.
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{inv.invoiceNumber}</p>
          <Badge
            className={
              inv.status === "Paid"
                ? "bg-green-100 text-green-600"
                : inv.status === "Sent"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-600"
            }
          >
            {inv.status}
          </Badge>
        </div>
        <div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
          <p>
            <span className="text-foreground/80">Client:</span>{" "}
            {inv.sale?.client?.name ?? "—"}
          </p>
          <p>
            <span className="text-foreground/80">Project:</span>{" "}
            {inv.sale?.project?.name ?? "—"}
          </p>
          {inv.lpoNumber ? (
            <p className="sm:col-span-2">
              <span className="text-foreground/80">LPO:</span> {inv.lpoNumber}
            </p>
          ) : null}
          <p>
            <span className="text-foreground/80">Total:</span>{" "}
            {CURRENCY} {parseFloat(String(inv.totalAmount)).toLocaleString()}
          </p>
          {inv.pendingAmount != null ? (
            <p>
              <span className="text-foreground/80">Pending:</span>{" "}
              {CURRENCY} {parseFloat(inv.pendingAmount).toLocaleString()}
            </p>
          ) : null}
          {inv.dueDate ? (
            <p className="sm:col-span-2">
              <span className="text-foreground/80">Due (current):</span>{" "}
              {new Date(inv.dueDate).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, () => {
            toast({
              title: "Check the form",
              description: "Please fix the highlighted fields and try again.",
              variant: "destructive",
            });
          })}
          className="space-y-6 pt-4"
        >
            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., ZDT/S20-12345" {...field} />
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
                        field.onChange(e.target.value ? new Date(e.target.value) : null)
                      }
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Setting this date marks the invoice <strong>Sent</strong>. Clear it to return to <strong>Generated</strong> (not applicable if status is already Paid).
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
                disabled={updateInvoiceMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateInvoiceMutation.isPending ? "Updating..." : "Update Invoice"}
              </Button>
            </div>
          </form>
        </Form>
    </>
  ) : null;

  if (isMobile) {
    return (
      <Drawer open={show} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="p-6 max-h-[90vh] overflow-y-auto">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={show} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
}
