import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCashbookSchema, type CashbookEntry, type AccountHead, type CashbookEntryWithAccountHead } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PaymentAllocationModal } from "@/components/modals/payment-allocation-modal";

export default function CashbookPage() {
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPayDebtModalOpen, setIsPayDebtModalOpen] = useState(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isAccountHeadModalOpen, setIsAccountHeadModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<CashbookEntry | null>(null);
  const [selectedPaymentForAllocation, setSelectedPaymentForAllocation] = useState<CashbookEntryWithAccountHead | null>(null);
  const [selectedEntryForEdit, setSelectedEntryForEdit] = useState<CashbookEntryWithAccountHead | null>(null);
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



  // Transaction Form
  const transactionForm = useForm({
    resolver: zodResolver(insertCashbookSchema.extend({
      transactionDate: insertCashbookSchema.shape.transactionDate.refine((date) => date instanceof Date, {
        message: "Please select a valid date",
      }),
    })),
    defaultValues: {
      transactionDate: new Date(),
      transactionType: "Invoice",
      category: "",
      amount: "",
      isInflow: 1,
      description: "",
      accountHeadId: "",
      counterparty: "",
      paymentMethod: "Cash",
      referenceType: "manual",
      isPending: 0,
      notes: "",
    },
  });

  // Debt Payment Form
  const debtPaymentForm = useForm({
    resolver: zodResolver(z.object({
      amount: z.string().min(1, "Amount is required").refine(
        (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
        "Amount must be a positive number"
      ),
      paymentMethod: z.string().min(1, "Payment method is required"),
      paymentDate: z.date({
        required_error: "Payment date is required",
      }),
    })),
    defaultValues: {
      amount: "",
      paymentMethod: "Cash",
      paymentDate: new Date(),
    },
  });

  // Edit Transaction Form
  const editTransactionForm = useForm({
    resolver: zodResolver(insertCashbookSchema.extend({
      transactionDate: insertCashbookSchema.shape.transactionDate.refine((date) => date instanceof Date, {
        message: "Please select a valid date",
      }),
    })),
    defaultValues: {
      transactionDate: new Date(),
      transactionType: "Invoice",
      category: "",
      amount: "",
      isInflow: 1,
      description: "",
      accountHeadId: "",
      counterparty: "",
      paymentMethod: "Cash",
      referenceType: "manual",
      isPending: 0,
      notes: "",
    },
  });

  // Mutations
  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/cashbook", data);
      return response.json();
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
    onError: (error: any) => {
      console.error("Create transaction error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to add transaction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const payDebtMutation = useMutation({
    mutationFn: async ({ debtId, data }: { debtId: string; data: any }) => {
      const response = await apiRequest("POST", `/api/cashbook/pay-debt/${debtId}`, data);
      return response.json();
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
    onError: (error: any) => {
      console.error("Debt payment error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to record debt payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createAccountHeadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/account-heads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account-heads"] });
      setIsAccountHeadModalOpen(false);
      toast({
        title: "Account head created",
        description: "New account head has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create account head. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/cashbook/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook/summary"] });
      setIsEditModalOpen(false);
      setSelectedEntryForEdit(null);
      editTransactionForm.reset();
      toast({
        title: "Transaction updated successfully",
        description: "Your cashbook has been updated.",
      });
    },
    onError: (error: any) => {
      console.error("Update transaction error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update transaction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cashbook/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbook/summary"] });
      toast({
        title: "Transaction deleted successfully",
        description: "The transaction has been removed from your cashbook.",
      });
    },
    onError: (error: any) => {
      console.error("Delete transaction error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete transaction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTransactionTypeChange = (transactionType: string) => {
    // Auto-set money flow based on transaction type
    let isInflow = 1;
    
    switch (transactionType) {
      case "Invoice":
      case "Investment":
        isInflow = 1; // Money in
        break;
      case "Supplier Payment":
      case "Expense":
      case "Withdrawal":
        isInflow = 0; // Money out
        break;
      default:
        // Keep current values for "Other"
        break;
    }
    
    transactionForm.setValue("isInflow", isInflow);
    // Remove pending logic - all transactions are completed
    transactionForm.setValue("isPending", 0);
  };

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
    
    console.log("Debt payment form data:", data);
    console.log("Selected debt:", selectedDebt);
    
    const processedData = {
      paidAmount: parseFloat(data.amount),
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate,
    };
    
    console.log("Processed data:", processedData);
    payDebtMutation.mutate({ debtId: selectedDebt.id, data: processedData });
  };

  const openPayDebtModal = (debt: CashbookEntry) => {
    setSelectedDebt(debt);
    debtPaymentForm.setValue("amount", debt.amount);
    setIsPayDebtModalOpen(true);
  };

  const openAllocationModal = (payment: CashbookEntryWithAccountHead) => {
    setSelectedPaymentForAllocation(payment);
    setIsAllocationModalOpen(true);
  };

  const openEditModal = (entry: CashbookEntryWithAccountHead) => {
    setSelectedEntryForEdit(entry);
    editTransactionForm.reset({
      transactionDate: new Date(entry.transactionDate),
      transactionType: entry.transactionType,
      category: entry.category || "",
      amount: entry.amount,
      isInflow: entry.isInflow,
      description: entry.description,
      accountHeadId: entry.accountHeadId,
      counterparty: entry.counterparty || "",
      paymentMethod: entry.paymentMethod || "Cash",
      referenceType: entry.referenceType || "manual",
      isPending: entry.isPending,
      notes: entry.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditTransactionTypeChange = (transactionType: string) => {
    // Auto-set money flow based on transaction type
    let isInflow = 1;
    
    switch (transactionType) {
      case "Invoice":
      case "Investment":
        isInflow = 1; // Money in
        break;
      case "Supplier Payment":
      case "Expense":
      case "Withdrawal":
        isInflow = 0; // Money out
        break;
      default:
        // Keep current values for "Other"
        break;
    }
    
    editTransactionForm.setValue("isInflow", isInflow);
    editTransactionForm.setValue("isPending", 0);
  };

  const onSubmitEditTransaction = (data: any) => {
    if (!selectedEntryForEdit) return;
    
    const processedData = {
      ...data,
      isInflow: parseInt(data.isInflow),
      isPending: parseInt(data.isPending),
      amount: parseFloat(data.amount).toFixed(2),
      accountHeadId: data.accountHeadId,
    };
    updateTransactionMutation.mutate({ id: selectedEntryForEdit.id, data: processedData });
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm("Are you sure you want to delete this transaction? This action cannot be undone.")) {
      deleteTransactionMutation.mutate(id);
    }
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
         <div className="flex gap-2">
           <Dialog open={isAccountHeadModalOpen} onOpenChange={setIsAccountHeadModalOpen}>
             <DialogTrigger asChild>
               <Button variant="outline">
                 <Plus className="h-4 w-4 mr-2" />
                 Create Account Head
               </Button>
             </DialogTrigger>
             <DialogContent className="max-w-md">
               <DialogHeader>
                 <DialogTitle>Create New Account Head</DialogTitle>
               </DialogHeader>
               <form onSubmit={(e) => {
                 e.preventDefault();
                 const formData = new FormData(e.currentTarget);
                 createAccountHeadMutation.mutate({
                   name: formData.get('name') as string,
                   type: formData.get('type') as string,
                 });
               }} className="space-y-4">
                 <div>
                   <label className="text-sm font-medium">Account Head Name</label>
                   <Input name="name" placeholder="e.g., Office Rent, Transport, Marketing" required />
                 </div>
                 <div>
                   <label className="text-sm font-medium">Type</label>
                   <Select name="type" defaultValue="Other">
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Client">Client</SelectItem>
                       <SelectItem value="Supplier">Supplier</SelectItem>
                       <SelectItem value="Other">Other</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <Button type="submit" className="w-full" disabled={createAccountHeadMutation.isPending}>
                   {createAccountHeadMutation.isPending ? "Creating..." : "Create Account Head"}
                 </Button>
               </form>
             </DialogContent>
           </Dialog>
           
           <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        handleTransactionTypeChange(value);
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select transaction type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Invoice">Invoice (Money In)</SelectItem>
                          <SelectItem value="Investment">Investment (Money In)</SelectItem>
                          <SelectItem value="Supplier Payment">Supplier Payment (Money Out)</SelectItem>
                          <SelectItem value="Expense">Expense (Money Out)</SelectItem>
                          <SelectItem value="Withdrawal">Withdrawal (Money Out)</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                                 />

                 <FormField
                   control={transactionForm.control}
                   name="category"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Category (Optional)</FormLabel>
                       <FormControl>
                         <Input placeholder="e.g., Fuel Sales, Office Rent, Salary, Transport" {...field} />
                       </FormControl>
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
                        <Input placeholder="e.g., Diesel purchase from supplier, Fuel delivery to client, Office rent payment" {...field} />
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
                        <Input placeholder="e.g., Supplier name, Client name, Bank name, Employee name" {...field} />
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
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="Debit Card">Debit Card</SelectItem>
                          <SelectItem value="Credit">Credit (Debt)</SelectItem>
                          <SelectItem value="Letter of Credit">Letter of Credit</SelectItem>
                          <SelectItem value="Trade Credit">Trade Credit</SelectItem>
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
                        <Textarea placeholder="e.g., Invoice number, LPO reference, delivery details, payment terms" {...field} />
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

   

      {/* All Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
                                     <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account Head</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Allocation Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                            {entries.map((entry: CashbookEntryWithAccountHead) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.transactionDate)}</TableCell>
                  <TableCell>{entry.accountHead?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge className={getTransactionTypeColor(entry.transactionType, entry.isInflow)}>
                      {entry.transactionType}
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.category || "—"}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{entry.paymentMethod || "—"}</TableCell>
                  <TableCell className={entry.isInflow === 1 ? "text-green-600" : "text-red-600"}>
                    {entry.isInflow === 1 ? "+" : "-"}{formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell>
                    {entry.isInflow === 1 && entry.accountHead?.type === "Client" ? (
                      <Badge 
                        className={
                          entry.allocationStatus === "Fully Allocated" ? "bg-green-100 text-green-600" :
                          entry.allocationStatus === "Partially Allocated" ? "bg-blue-100 text-blue-600" :
                          entry.allocationStatus === "Not Allocated" ? "bg-orange-100 text-orange-600" :
                          "bg-gray-100 text-gray-600"
                        }
                      >
                        {entry.allocationStatus || "Not Allocated"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {/* Edit button for all transactions */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(entry)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      
                      {/* Delete button for all transactions */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTransaction(entry.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      
                      {/* Allocate button for client payments that have unallocated amounts */}
                      {entry.isInflow === 1 && entry.accountHead?.type === "Client" && entry.allocationStatus !== "Fully Allocated" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAllocationModal(entry)}
                        >
                          Allocate
                        </Button>
                      )}
                      
                      {/* Settle pending button for pending debts */}
                      {entry.isPending === 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPayDebtModal(entry)}
                        >
                          Settle Pending
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pay Debt Modal */}
      <Dialog open={isPayDebtModalOpen} onOpenChange={setIsPayDebtModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                            <SelectItem value="Debit Card">Debit Card</SelectItem>
                            <SelectItem value="Letter of Credit">Letter of Credit</SelectItem>
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

      {/* Edit Transaction Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <Form {...editTransactionForm}>
            <form onSubmit={editTransactionForm.handleSubmit(onSubmitEditTransaction)} className="space-y-4">
              <FormField
                control={editTransactionForm.control}
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
                control={editTransactionForm.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      handleEditTransactionTypeChange(value);
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Invoice">Invoice (Money In)</SelectItem>
                        <SelectItem value="Investment">Investment (Money In)</SelectItem>
                        <SelectItem value="Supplier Payment">Supplier Payment (Money Out)</SelectItem>
                        <SelectItem value="Expense">Expense (Money Out)</SelectItem>
                        <SelectItem value="Withdrawal">Withdrawal (Money Out)</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editTransactionForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Fuel Sales, Office Rent, Salary, Transport" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editTransactionForm.control}
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
                control={editTransactionForm.control}
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
                control={editTransactionForm.control}
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
                control={editTransactionForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Diesel purchase from supplier, Fuel delivery to client, Office rent payment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editTransactionForm.control}
                name="counterparty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Counterparty</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Supplier name, Client name, Bank name, Employee name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editTransactionForm.control}
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
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Debit Card">Debit Card</SelectItem>
                        <SelectItem value="Credit">Credit (Debt)</SelectItem>
                        <SelectItem value="Letter of Credit">Letter of Credit</SelectItem>
                        <SelectItem value="Trade Credit">Trade Credit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editTransactionForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Invoice number, LPO reference, delivery details, payment terms" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={updateTransactionMutation.isPending}>
                {updateTransactionMutation.isPending ? "Updating..." : "Update Transaction"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Allocation Modal */}
      <PaymentAllocationModal
        isOpen={isAllocationModalOpen}
        onOpenChange={setIsAllocationModalOpen}
        cashbookEntryId={selectedPaymentForAllocation?.id}
        totalAmount={selectedPaymentForAllocation ? parseFloat(selectedPaymentForAllocation.amount) : 0}
        accountHeadId={selectedPaymentForAllocation?.accountHeadId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/cashbook"] });
          queryClient.invalidateQueries({ queryKey: ["/api/cashbook/payment-allocations"] });
        }}
      />
    </div>
  );
}