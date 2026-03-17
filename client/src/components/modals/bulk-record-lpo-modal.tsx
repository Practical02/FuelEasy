import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const bulkLpoSchema = z.object({
  lpoNumber: z.string().min(1, "LPO number is required"),
  deliveryNoteNumber: z.string().min(1, "Delivery note number is required"),
  lpoReceivedDate: z.string().min(1, "LPO received date is required"),
});

type BulkLpoForm = z.infer<typeof bulkLpoSchema>;

interface BulkRecordLpoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleIds: string[];
  onSuccess?: () => void;
}

export default function BulkRecordLpoModal({
  open,
  onOpenChange,
  saleIds,
  onSuccess,
}: BulkRecordLpoModalProps) {
  const { toast } = useToast();
  const form = useForm<BulkLpoForm>({
    resolver: zodResolver(bulkLpoSchema),
    defaultValues: {
      lpoNumber: "",
      deliveryNoteNumber: "",
      lpoReceivedDate: new Date().toISOString().slice(0, 10),
    },
  });

  const bulkRecordMutation = useMutation({
    mutationFn: async (data: BulkLpoForm) => {
      const res = await apiRequest("POST", "/api/sales/bulk-record-lpo", {
        saleIds,
        lpoNumber: data.lpoNumber,
        deliveryNoteNumber: data.deliveryNoteNumber,
        lpoReceivedDate: data.lpoReceivedDate ? new Date(data.lpoReceivedDate).toISOString() : undefined,
      });
      return res.json();
    },
    onSuccess: (result: { updated: number; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales?status=Pending%20LPO"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales?status=LPO%20Received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/overview"] });
      const { updated, errors } = result;
      if (errors.length > 0) {
        toast({
          title: "Bulk LPO recorded with issues",
          description: `${updated} sale(s) updated. ${errors.length} error(s): ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "…" : ""}`,
          variant: "default",
        });
      } else {
        toast({
          title: "LPO recorded",
          description: `LPO recorded for ${updated} sale(s).`,
        });
      }
      form.reset({
        lpoNumber: "",
        deliveryNoteNumber: "",
        lpoReceivedDate: new Date().toISOString().slice(0, 10),
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record LPO for selected sales. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BulkLpoForm) => {
    bulkRecordMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record LPO for selected sales</DialogTitle>
          <DialogDescription>
            Enter LPO details to apply to all {saleIds.length} selected sale(s). Status will be set to &quot;LPO Received&quot;.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lpoNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LPO Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. LPO-2025-001" {...field} />
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
                  <FormLabel>Delivery Note No.</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. DN-2025-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lpoReceivedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LPO Received Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={bulkRecordMutation.isPending}>
                {bulkRecordMutation.isPending ? "Recording…" : "Record LPO for all"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
