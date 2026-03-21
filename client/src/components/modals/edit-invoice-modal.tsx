import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { InsertInvoice, Invoice } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

/** Only fields we edit — full `insertInvoiceSchema` fails validation when reset from API (date/decimal shapes, id/createdAt). */
const editInvoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.coerce.date(),
  submissionDate: z.union([z.coerce.date(), z.null()]).optional(),
});

interface EditInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
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
      const response = await apiRequest("PATCH", `/api/invoices/${invoice.id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Updated",
        description: "Invoice has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
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
      totalAmount: invoice.totalAmount,
      vatAmount: invoice.vatAmount,
      status: invoice.status,
    };
    updateInvoiceMutation.mutate(payload);
  };

  if (!invoice) {
    return null;
  }

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>Edit Invoice - {invoice.invoiceNumber}</DialogTitle>
        <DialogDescription>
          Edit the details of this invoice.
        </DialogDescription>
      </DialogHeader>

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
                  <FormLabel>Submission date (optional)</FormLabel>
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
                    Clears to use invoice date for payment due. Due date updates to one month after submission or invoice date.
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
