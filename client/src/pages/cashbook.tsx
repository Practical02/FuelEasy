import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCashbookSchema, type CashbookEntry, type AccountHead, type CashbookEntryWithAccountHead } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function CashbookPage() {
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isPayDebtModalOpen, setIsPayDebtModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<CashbookEntryWithAccountHead | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: entries = [], isLoading: entriesLoading } = useQuery<CashbookEntryWithAccountHead[]>({
    queryKey: ["/api/cashbook"],
  });

  const { data: accountHeads = [], isLoading: accountHeadsLoading } = useQuery<AccountHead[]>({
    queryKey: ["/api/account-heads"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<{
    totalInflow: number;
    totalOutflow: number;
    pendingDebts: number;
    availableBalance: number;
  }>({
    queryKey: ["/api/cashbook/summary"],
  });

  const { data: pendingDebts = [], isLoading: debtsLoading } = useQuery<CashbookEntry[]>({
    queryKey: ["/api/cashbook/pending-debts"],
  });

  // Transaction Form
  const transactionForm = useForm({
    resolver: zodResolver(insertCashbookSchema.extend({
      transactionDate: insertCashbookSchema.shape.transactionDate.refine((date) => date instanceof Date, {
        message: "Please select a valid date",
      }),
    })),
    defaultValues: {
      transactionDate: new Date(),
      transactionType: "Investment",
      amount: "",
      isInflow: 1,
      description: "",
      accountHeadId: "", // New field
      counterparty: "",
      paymentMethod: "Cash",
      referenceType: "manual",
      isPending: 0,
      notes: "",
    },
  });

  // Debt Payment Form
  const debtPaymentForm = useForm({
    resolver: zodResolver(insertCashbookSchema.pick({
      amount: true,
      paymentMethod: true,
    }).extend({
      paymentDate: insertCashbookSchema.shape.transactionDate,
    })),
    defaultValues: {
      amount: "",
      paymentMethod: "Cash",
      paymentDate: new Date(),
    },
  });

  // Mutations
  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/cashbook", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook/pending-debts"] });
      setIsTransactionModalOpen(false);
      transactionForm.reset();
      toast({
        title: "Transaction added successfully",
        description: "Your cashbook has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add transaction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const payDebtMutation = useMutation({
    mutationFn: async ({ debtId, data }: { debtId: string; data: any }) => {
      return apiRequest(`/api/cashbook/pay-debt/${debtId}`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook/pending-debts"] });
      setIsPayDebtModalOpen(false);
      setSelectedDebt(null);
      debtPaymentForm.reset();
      toast({
        title: "Debt payment recorded",
        description: "The debt has been marked as paid.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record debt payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmitTransaction = (data: any) => {
    const processedData = {
      ...data,
      isInflow: parseInt(data.isInflow),
      isPending: parseInt(data.isPending),
      amount: parseFloat(data.amount).toFixed(2),
      accountHeadId: data.accountHeadId, // Include accountHeadId
    };
    createTransactionMutation.mutate(processedData);
  };

  const onSubmitDebtPayment = (data: any) => {
    if (!selectedDebt) return;
    
    const processedData = {
      paidAmount: parseFloat(data.amount),
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate,
    };
    payDebtMutation.mutate({ debtId: selectedDebt.id, data: processedData });
  };

  const openPayDebtModal = (debt: CashbookEntry) => {
    setSelectedDebt(debt);
    debtPaymentForm.setValue("amount", debt.amount);
    setIsPayDebtModalOpen(true);
  };

  const getTransactionTypeColor = (type: string, isInflow: number) => {
    if (isInflow === 1) return "bg-green-100 text-green-800";
    return "bg-red-100 text-red-800";
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(num);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-GB");
  };

  if (entriesLoading || summaryLoading) {
    return <div className="p-6">Loading cashbook...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Company Cashbook</h1>
        <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Transaction</DialogTitle>
            </DialogHeader>
            <Form {...transactionForm}>
              <form onSubmit={transactionForm.handleSubmit(onSubmitTransaction)} className="space-y-4">
                <FormField
                  control={transactionForm.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="transactionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select transaction type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Investment">Personal Investment</SelectItem>
                          <SelectItem value="Profit Withdrawal">Profit Withdrawal</SelectItem>
                          <SelectItem value="Stock Purchase">Stock Purchase (Credit)</SelectItem>
                          <SelectItem value="Stock Payment">Stock Payment</SelectItem>
                          <SelectItem value="Sale Revenue">Sale Revenue</SelectItem>
                          <SelectItem value="Expense">Business Expense</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="accountHeadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Head</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an account head" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accountHeads.map((head) => (
                            <SelectItem key={head.id} value={head.id}>
                              {head.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="isInflow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Money Flow</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Money In (Credit)</SelectItem>
                          <SelectItem value="0">Money Out (Debit)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (AED)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter transaction description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="counterparty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Counterparty</FormLabel>
                      <FormControl>
                        <Input placeholder="Who is this transaction with?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Credit">Credit (Debt)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="isPending"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Paid/Completed</SelectItem>
                          <SelectItem value="1">Pending (Debt)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transactionForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createTransactionMutation.isPending}>
                  {createTransactionMutation.isPending ? "Adding..." : "Add Transaction"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.availableBalance || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.totalInflow || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary?.totalOutflow || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Debts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary?.pendingDebts || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="all-transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all-transactions">All Transactions</TabsTrigger>
          <TabsTrigger value="pending-debts">Pending Debts ({pendingDebts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all-transactions">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Account Head</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: CashbookEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.transactionDate)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
                        <Badge className={getTransactionTypeColor(entry.transactionType, entry.isInflow)}>
                          {entry.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.accountHead.name || "—"}</TableCell>
                      <TableCell>{entry.paymentMethod || "—"}</TableCell>
                      <TableCell className={entry.isInflow === 1 ? "text-green-600" : "text-red-600"}>
                        {entry.isInflow === 1 ? "+" : "-"}{formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell>
                        {entry.isPending === 1 ? (
                          <Badge variant="outline" className="text-orange-600">Pending</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">Completed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-debts">
          <Card>
            <CardHeader>
              <CardTitle>Pending Debts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Account Head</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDebts.map((debt: CashbookEntry) => (
                    <TableRow key={debt.id}>
                      <TableCell>{formatDate(debt.transactionDate)}</TableCell>
                      <TableCell>{debt.description}</TableCell>
                      <TableCell>{debt.accountHead.name || "—"}</TableCell>
                      <TableCell className="text-red-600">
                        {formatCurrency(debt.amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPayDebtModal(debt)}
                        >
                          Mark as Paid
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pay Debt Modal */}
      <Dialog open={isPayDebtModalOpen} onOpenChange={setIsPayDebtModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Debt as Paid</DialogTitle>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm"><strong>Original Debt:</strong> {selectedDebt.description}</p>
                <p className="text-sm"><strong>Amount:</strong> {formatCurrency(selectedDebt.amount)}</p>
                <p className="text-sm"><strong>Counterparty:</strong> {selectedDebt.counterparty}</p>
              </div>
              
              <Form {...debtPaymentForm}>
                <form onSubmit={debtPaymentForm.handleSubmit(onSubmitDebtPayment)} className="space-y-4">
                  <FormField
                    control={debtPaymentForm.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={debtPaymentForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Amount (AED)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={debtPaymentForm.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={payDebtMutation.isPending}>
                    {payDebtMutation.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}