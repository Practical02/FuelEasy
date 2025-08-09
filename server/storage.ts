import { 
  type User, 
  type InsertUser, 
  type Stock, 
  type InsertStock,
  type Client,
  type InsertClient,
  type Project,
  type InsertProject,
  type ProjectWithClient,
  type Sale,
  type InsertSale,
  type SaleWithClient,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
  type PaymentWithSaleAndClient,
  type CashbookEntry,
  type InsertCashbook,
  type AccountHead,
  type InsertAccountHead,
  type CashbookEntryWithAccountHead,
  type CashbookPaymentAllocation,
  type InsertCashbookPaymentAllocation,
  type CashbookPaymentAllocationWithInvoice,
  type BusinessSettings,
  type InsertBusinessSettings,
  users,
  stock,
  clients,
  projects,
  sales,
  invoices,
  payments,
  cashbook,
  accountHeads,
  cashbookPaymentAllocations,
  businessSettings
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, sql, and } from "drizzle-orm";

// Initialize database connection
const connectionString = process.env.DATABASE_URL || "";
const sql_conn = neon(connectionString);
const db = drizzle(sql_conn, { schema: { users, stock, clients, projects, sales, invoices, payments, cashbook, accountHeads, cashbookPaymentAllocations, businessSettings } });

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Stock methods
  getStock(): Promise<Stock[]>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStock(id: string, stock: InsertStock): Promise<Stock | undefined>;
  deleteStock(id: string): Promise<boolean>;
  getCurrentStockLevel(): Promise<number>;
  
  // Client methods
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: InsertClient): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  // Account Head methods
  getAccountHeads(): Promise<AccountHead[]>;
  createAccountHead(accountHead: InsertAccountHead): Promise<AccountHead>;
  
  // Project methods
  getProjects(clientId?: string): Promise<ProjectWithClient[]>;
  getProjectsByClient(clientId: string): Promise<ProjectWithClient[]>;
  getProject(id: string): Promise<ProjectWithClient | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: InsertProject): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Sale methods
  getSales(): Promise<SaleWithClient[]>;
  getSalesByClient(clientId: string): Promise<SaleWithClient[]>;
  getSalesByStatus(status: string): Promise<SaleWithClient[]>;
  getSale(id: string): Promise<SaleWithClient | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: string, sale: InsertSale): Promise<Sale | undefined>;
  updateSaleStatus(id: string, status: string): Promise<Sale | undefined>;
  deleteSale(id: string): Promise<boolean>;
  
  // Invoice methods
  getInvoices(): Promise<any[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: InsertInvoice): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  
  // Payment methods
  getPayments(): Promise<PaymentWithSaleAndClient[]>;
  getPaymentsBySale(saleId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  deletePayment(id: string): Promise<boolean>;
  migratePaymentsToCashbook(): Promise<number>;
  
  // Cashbook methods
  getCashbookEntries(): Promise<CashbookEntryWithAccountHead[]>;
  getCashbookEntry(id: string): Promise<CashbookEntry | undefined>;
  createCashbookEntry(entry: InsertCashbook): Promise<CashbookEntry>;
  updateCashbookEntry(id: string, entry: InsertCashbook): Promise<CashbookEntry | undefined>;
  deleteCashbookEntry(id: string): Promise<boolean>;
  getCashBalance(): Promise<number>;
  getPendingDebts(): Promise<CashbookEntry[]>;
  getTransactionSummary(): Promise<{
    totalInflow: number;
    totalOutflow: number;
    pendingDebts: number;
    availableBalance: number;
  }>;
  markDebtAsPaid(cashbookId: string, paidAmount: number, paymentMethod: string, paymentDate: Date): Promise<CashbookEntry>;
  
  // Cashbook Payment Allocation methods
  getCashbookPaymentAllocations(): Promise<CashbookPaymentAllocationWithInvoice[]>;
  createCashbookPaymentAllocation(allocation: InsertCashbookPaymentAllocation): Promise<CashbookPaymentAllocation>;
  getCashbookPaymentAllocationsByEntry(cashbookEntryId: string): Promise<CashbookPaymentAllocationWithInvoice[]>;
  getPendingInvoicesForAllocation(accountHeadId?: string): Promise<any[]>;
  getInvoiceAllocatedAmount(invoiceId: string): Promise<number>;
  updateInvoiceStatusIfPaid(invoiceId: string): Promise<void>;
  
  // Supplier Debt Tracking methods
  getSupplierDebts(): Promise<CashbookEntryWithAccountHead[]>;
  getSupplierOutstandingBalance(supplierId: string): Promise<number>;
  getSupplierPaymentHistory(supplierId: string): Promise<CashbookEntry[]>;
  
  // Client Payment Tracking methods
  getClientPayments(): Promise<CashbookEntryWithAccountHead[]>;
  getClientOutstandingBalance(clientId: string): Promise<number>;
  getClientPaymentHistory(clientId: string): Promise<CashbookEntry[]>;
  getOverdueClientPayments(daysThreshold: number): Promise<{
    client: Client;
    invoices: Array<{ id: string; invoiceNumber: string | null; invoiceDate: Date | null; pendingAmount: number; totalAmount: number }>;
    totalPending: number;
  }[]>;
  
  // Reporting methods
  getTotalRevenue(): Promise<number>;
  getSalesWithDelays(): Promise<any[]>;
  getTotalCOGS(): Promise<number>;
  getGrossProfit(): Promise<number>;
  getPendingLPOCount(): Promise<number>;
  getPendingLPOValue(): Promise<number>;
  getPendingBusinessReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]>;
  getVATReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]>;
  
  // Business Settings methods
  getBusinessSettings(): Promise<BusinessSettings>;
  updateBusinessSettings(settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Database storage - no in-memory maps needed
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getStock(): Promise<Stock[]> {
    return await db.select().from(stock).orderBy(desc(stock.createdAt));
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    // Calculate VAT and total cost
    const quantity = parseFloat(insertStock.quantityGallons);
    const pricePerGallon = parseFloat(insertStock.purchasePricePerGallon);
    const vatPercentage = parseFloat(insertStock.vatPercentage || "5.00");
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalCost = subtotal + vatAmount;
    
    const stockData = { 
      ...insertStock,
      vatPercentage: vatPercentage.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalCost: totalCost.toFixed(2)
    };
    
    const result = await db.insert(stock).values(stockData).returning();
    
    return result[0];
  }

  async getCurrentStockLevel(): Promise<number> {
    const [stockResult, salesResult] = await Promise.all([
      db.select({
        totalPurchased: sql<number>`COALESCE(SUM(${stock.quantityGallons}::numeric), 0)`,
      }).from(stock),
      db.select({
        totalSold: sql<number>`COALESCE(SUM(${sales.quantityGallons}::numeric), 0)`
      }).from(sales)
    ]);
    
    const totalPurchased = stockResult[0]?.totalPurchased || 0;
    const totalSold = salesResult[0]?.totalSold || 0;
    
    return totalPurchased - totalSold;
  }

  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(clients.name);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(insertClient).returning();
    const newClient = result[0];

    // Create an account head for the new client
    await this.createAccountHead({
      name: newClient.name,
      type: "Client",
    });

    return newClient;
  }

  async updateClient(id: string, insertClient: InsertClient): Promise<Client | undefined> {
    const result = await db
      .update(clients)
      .set(insertClient)
      .where(eq(clients.id, id))
      .returning();
    return result[0];
  }

  async deleteClient(id: string): Promise<boolean> {
    try {
      // Get the client first to understand what we're deleting
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1);

      if (client.length === 0) {
        return false;
      }

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Get all sales for this client
      const clientSales = await db
        .select()
        .from(sales)
        .where(eq(sales.clientId, id));

      // 2. For each sale, delete related data
      for (const sale of clientSales) {
        // Delete cashbook payment allocations for invoices of this sale
        const saleInvoices = await db
          .select()
          .from(invoices)
          .where(eq(invoices.saleId, sale.id));

        for (const invoice of saleInvoices) {
          await db
            .delete(cashbookPaymentAllocations)
            .where(eq(cashbookPaymentAllocations.invoiceId, invoice.id));
        }

        // Delete cashbook entries related to payments for this sale
        const salePayments = await db
          .select()
          .from(payments)
          .where(eq(payments.saleId, sale.id));

        for (const payment of salePayments) {
          await db
            .delete(cashbook)
            .where(and(
              eq(cashbook.referenceType, "payment"),
              eq(cashbook.referenceId, payment.id)
            ));
        }

        // Delete payments for this sale
        await db
          .delete(payments)
          .where(eq(payments.saleId, sale.id));

        // Delete invoices for this sale
        await db
          .delete(invoices)
          .where(eq(invoices.saleId, sale.id));
      }

      // 3. Delete all sales for this client
      await db
        .delete(sales)
        .where(eq(sales.clientId, id));

      // 4. Delete all projects for this client
      await db
        .delete(projects)
        .where(eq(projects.clientId, id));

      // 5. Delete the account head for this client (if it exists)
      await db
        .delete(accountHeads)
        .where(eq(accountHeads.name, client[0].name));

      // 6. Delete the client itself
      const result = await db
        .delete(clients)
        .where(eq(clients.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting client:", error);
      throw error;
    }
  }

  async getAccountHeads(): Promise<AccountHead[]> {
    return await db.select().from(accountHeads).orderBy(accountHeads.name);
  }

  async createAccountHead(insertAccountHead: InsertAccountHead): Promise<AccountHead> {
    const result = await db.insert(accountHeads).values(insertAccountHead).returning();
    return result[0];
  }

  // Project methods
  async getProjectsByClient(clientId: string): Promise<ProjectWithClient[]> {
    const result = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        description: projects.description,
        location: projects.location,
        status: projects.status,
        createdAt: projects.createdAt,
        client: clients
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.clientId, clientId))
      .orderBy(desc(projects.createdAt));
    
    return result.filter(r => r.client).map(r => ({
      ...r,
      client: r.client!
    }));
  }
  
  async getProjects(): Promise<ProjectWithClient[]> {
    const result = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        description: projects.description,
        location: projects.location,
        status: projects.status,
        createdAt: projects.createdAt,
        client: clients
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.createdAt));
    
    return result.filter(r => r.client).map(r => ({
      ...r,
      client: r.client!
    }));
  }

  async getProject(id: string): Promise<ProjectWithClient | undefined> {
    const result = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        description: projects.description,
        location: projects.location,
        status: projects.status,
        createdAt: projects.createdAt,
        client: clients
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, id))
      .limit(1);
    
    if (result[0]?.client) {
      return {
        ...result[0],
        client: result[0].client
      };
    }
    return undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(id: string, insertProject: InsertProject): Promise<Project | undefined> {
    const result = await db
      .update(projects)
      .set(insertProject)
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  async getSalesByClient(clientId: string): Promise<SaleWithClient[]> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        purchasePricePerGallon: sales.purchasePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
        lpoDueDate: sales.lpoDueDate,
        invoiceDate: sales.invoiceDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        cogs: sales.cogs,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
        client: clients,
        project: projects
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(eq(sales.clientId, clientId))
      .orderBy(desc(sales.createdAt));
    
    return result.map(r => ({
      ...r,
      client: r.client!,
      project: r.project
    }));
  }

  async getSales(): Promise<SaleWithClient[]> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        purchasePricePerGallon: sales.purchasePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
        lpoDueDate: sales.lpoDueDate,
        invoiceDate: sales.invoiceDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        cogs: sales.cogs,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
        client: clients,
        project: projects
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .orderBy(desc(sales.createdAt));
    
    return result.map(r => ({
      ...r,
      client: r.client!,
      project: r.project
    }));
  }

  async getSalesByStatus(status: string): Promise<SaleWithClient[]> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        purchasePricePerGallon: sales.purchasePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
        lpoDueDate: sales.lpoDueDate,
        invoiceDate: sales.invoiceDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        cogs: sales.cogs,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
        client: clients,
        project: projects
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(eq(sales.saleStatus, status))
      .orderBy(desc(sales.createdAt));
    
    return result.map(r => ({
      ...r,
      client: r.client!,
      project: r.project
    }));
  }

  async getSale(id: string): Promise<SaleWithClient | undefined> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        purchasePricePerGallon: sales.purchasePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
        lpoDueDate: sales.lpoDueDate,
        invoiceDate: sales.invoiceDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        cogs: sales.cogs,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
        client: clients,
        project: projects
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(eq(sales.id, id))
      .limit(1);
    
    if (result[0]?.client) {
      return {
        ...result[0],
        client: result[0].client,
        project: result[0].project
      };
    }
    return undefined;
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    // Calculate totals
    const quantity = parseFloat(insertSale.quantityGallons);
    const salePrice = parseFloat(insertSale.salePricePerGallon);
    const purchasePrice = parseFloat(insertSale.purchasePricePerGallon);
    const vatPercentage = insertSale.vatPercentage ? parseFloat(insertSale.vatPercentage) : 5.0;
    
    const subtotal = quantity * salePrice;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalAmount = subtotal + vatAmount;
    const cogs = quantity * purchasePrice;
    const grossProfit = subtotal - cogs; // Exclude VAT for GP
    
    const saleData = {
      ...insertSale,
      saleStatus: insertSale.saleStatus || "Pending LPO",
      vatPercentage: insertSale.vatPercentage || "5.00",
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      cogs: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2)
    };
    
    const result = await db.insert(sales).values(saleData).returning();
    
    // Create cashbook entry for sale revenue when sale is completed/paid
    if (saleData.saleStatus === "Paid") {
      await this.createCashbookEntry({
        transactionDate: insertSale.saleDate,
        transactionType: "Sale Revenue",
        accountHeadId: insertSale.clientId,
        amount: totalAmount.toFixed(2),
        isInflow: 1,
        description: `Sale revenue - ${quantity} gallons`,
        counterparty: "Client",
        paymentMethod: "Cash",
        referenceType: "sale",
        referenceId: result[0].id,
        isPending: 0,
        notes: `Sale at ${salePrice}/gallon, Purchase at ${purchasePrice}/gallon`
      });
    }
    
    return result[0];
  }

  async updateSaleStatus(id: string, status: string): Promise<Sale | undefined> {
    const result = await db
      .update(sales)
      .set({ saleStatus: status })
      .where(eq(sales.id, id))
      .returning();
    
    return result[0];
  }

  async getInvoices(): Promise<any[]> {
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .orderBy(desc(invoices.createdAt));

    const allPayments = await db.select().from(payments);
    const paymentsBySaleId = allPayments.reduce((acc, p) => {
        if (!acc[p.saleId]) {
            acc[p.saleId] = [];
        }
        acc[p.saleId].push(p);
        return acc;
    }, {} as Record<string, Payment[]>);

    return results.map(r => {
      if (!r.sales || !r.clients) {
        return { ...r.invoices, sale: null };
      }
      
      const salePayments = paymentsBySaleId[r.sales.id] || [];
      const totalPaid = salePayments.reduce((sum, p) => sum + parseFloat(p.amountReceived), 0);
      const pendingAmount = parseFloat(r.sales.totalAmount) - totalPaid;

      const sale = {
        ...r.sales,
        client: r.clients,
        project: r.projects || null,
        pendingAmount: pendingAmount.toFixed(2)
      };
      
      return { ...r.invoices, sale };
    });
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const result = await db.insert(invoices).values(insertInvoice).returning();
    // Update sale status to "Invoiced"
    await this.updateSaleStatus(insertInvoice.saleId, "Invoiced");
    return result[0];
  }

  async updateInvoice(id: string, insertInvoice: InsertInvoice): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set(insertInvoice)
      .where(eq(invoices.id, id))
      .returning();
    return result[0];
  }

  async getPayments(): Promise<PaymentWithSaleAndClient[]> {
    const paymentsData = await db.select().from(payments).orderBy(desc(payments.createdAt));
    const result: PaymentWithSaleAndClient[] = [];
    
    for (const payment of paymentsData) {
      const saleData = await db.select().from(sales).where(eq(sales.id, payment.saleId)).limit(1);
      if (saleData[0]) {
        const clientData = await db.select().from(clients).where(eq(clients.id, saleData[0].clientId)).limit(1);
        if (clientData[0]) {
          result.push({
            ...payment,
            sale: {
              ...saleData[0],
              client: clientData[0]
            }
          });
        }
      }
    }
    
    return result;
  }

  async getPaymentsBySale(saleId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.saleId, saleId));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(insertPayment).returning();
    const payment = result[0];

    const sale = await this.getSale(insertPayment.saleId);
    if (!sale) {
      throw new Error("Sale not found for this payment");
    }

    const client = await this.getClient(sale.clientId);
    if (!client) {
      throw new Error("Client not found for this sale");
    }

    // Find or create account head for the client using database
    let clientAccountHead = await db
      .select()
      .from(accountHeads)
      .where(eq(accountHeads.name, client.name))
      .limit(1);

    if (clientAccountHead.length === 0) {
      const newAccountHead = await db.insert(accountHeads).values({
        name: client.name,
        type: "Client",
      }).returning();
      clientAccountHead = newAccountHead;
    }

    // Create cashbook entry for payment received
    const cashbookEntry = await this.createCashbookEntry({
      transactionDate: insertPayment.paymentDate,
      transactionType: "Invoice",
      category: "Payment Received",
      accountHeadId: clientAccountHead[0].id,
      amount: parseFloat(insertPayment.amountReceived).toFixed(2),
      isInflow: 1,
      description: `Payment received from ${client.name} for LPO ${sale.lpoNumber || "N/A"}`,
      counterparty: client.name,
      paymentMethod: insertPayment.paymentMethod,
      referenceType: "payment",
      referenceId: payment.id,
      isPending: 0,
      notes: `Amount: ${insertPayment.amountReceived}`
    });

    // Find the invoice for this sale and automatically allocate the payment
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.saleId, insertPayment.saleId))
      .limit(1);

    if (invoice[0]) {
      // Automatically allocate the full payment amount to the invoice
      await this.createCashbookPaymentAllocation({
        cashbookEntryId: cashbookEntry.id,
        invoiceId: invoice[0].id,
        amountAllocated: insertPayment.amountReceived,
      });
    }

    const totalPaid = (await this.getPaymentsBySale(insertPayment.saleId))
      .reduce((sum, p) => sum + parseFloat(p.amountReceived), 0);

    const saleTotal = parseFloat(sale.totalAmount);
    
    let newStatus = sale.saleStatus;
    if (totalPaid >= saleTotal) {
      newStatus = "Paid";
    } else if (sale.saleStatus !== "Paid") {
      newStatus = "Invoiced"; 
    }

    if (newStatus !== sale.saleStatus) {
      await this.updateSaleStatus(insertPayment.saleId, newStatus);
    }
    
    return payment;
  }

  // Cashbook methods
  async getCashbookEntries(): Promise<CashbookEntryWithAccountHead[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .orderBy(desc(cashbook.transactionDate));

    // Calculate allocation status for client payments
    const entriesWithStatus = await Promise.all(
      result.map(async (r) => {
        const entryWithAccountHead = {
          ...r,
          accountHead: r.accountHead!,
        };

        // Only calculate status for client payments (inflow transactions)
        if (r.isInflow === 1 && r.accountHead && r.accountHead.type === "Client") {
          const totalAllocated = await this.getCashbookEntryAllocatedAmount(r.id);
          const totalAmount = parseFloat(r.amount);
          
          let allocationStatus = "Not Allocated";
          if (totalAllocated > 0) {
            if (Math.abs(totalAllocated - totalAmount) < 0.01) {
              allocationStatus = "Fully Allocated";
            } else if (totalAllocated < totalAmount) {
              allocationStatus = "Partially Allocated";
            } else {
              allocationStatus = "Over-allocated";
            }
          }
          
          return {
            ...entryWithAccountHead,
            allocationStatus,
            allocatedAmount: totalAllocated,
          };
        }

        return entryWithAccountHead;
      })
    );

    return entriesWithStatus;
  }

  async getCashbookEntry(id: string): Promise<CashbookEntry | undefined> {
    const result = await db.select().from(cashbook).where(eq(cashbook.id, id));
    return result[0];
  }

  async createCashbookEntry(insertCashbook: InsertCashbook): Promise<CashbookEntry> {
    try {
      // Validate required fields
      if (!insertCashbook.transactionDate || !insertCashbook.transactionType || !insertCashbook.amount || !insertCashbook.accountHeadId) {
        throw new Error("Missing required fields: transactionDate, transactionType, amount, accountHeadId");
      }

      // Validate amount is positive
      const amount = parseFloat(insertCashbook.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Validate account head exists
      const accountHead = await db.select().from(accountHeads).where(eq(accountHeads.id, insertCashbook.accountHeadId)).limit(1);
      if (accountHead.length === 0) {
        throw new Error("Account head not found");
      }

      const result = await db.insert(cashbook).values(insertCashbook).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating cashbook entry:", error);
      throw error;
    }
  }

  async updateCashbookEntry(id: string, updateCashbook: InsertCashbook): Promise<CashbookEntry | undefined> {
    try {
      // Validate required fields
      if (!updateCashbook.transactionDate || !updateCashbook.transactionType || !updateCashbook.amount || !updateCashbook.accountHeadId) {
        throw new Error("Missing required fields: transactionDate, transactionType, amount, accountHeadId");
      }

      // Validate amount is positive
      const amount = parseFloat(updateCashbook.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Validate account head exists
      const accountHead = await db.select().from(accountHeads).where(eq(accountHeads.id, updateCashbook.accountHeadId)).limit(1);
      if (accountHead.length === 0) {
        throw new Error("Account head not found");
      }

      // Check if entry exists
      const existingEntry = await db.select().from(cashbook).where(eq(cashbook.id, id)).limit(1);
      if (existingEntry.length === 0) {
        return undefined;
      }

      const result = await db.update(cashbook).set(updateCashbook).where(eq(cashbook.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating cashbook entry:", error);
      throw error;
    }
  }

  async deleteCashbookEntry(id: string): Promise<boolean> {
    try {
      // Get the cashbook entry first to understand what we're deleting
      const entry = await db
        .select()
        .from(cashbook)
        .where(eq(cashbook.id, id))
        .limit(1);

      if (entry.length === 0) {
        return false;
      }

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Delete all cashbook payment allocations for this entry
      await db
        .delete(cashbookPaymentAllocations)
        .where(eq(cashbookPaymentAllocations.cashbookEntryId, id));

      // 2. If this is a payment-related cashbook entry, also delete the payment
      if (entry[0].referenceType === "payment" && entry[0].referenceId) {
        // Get the payment details before deleting
        const payment = await db
          .select()
          .from(payments)
          .where(eq(payments.id, entry[0].referenceId))
          .limit(1);

        if (payment.length > 0) {
          const sale = await db
            .select()
            .from(sales)
            .where(eq(sales.id, payment[0].saleId))
            .limit(1);

          // Delete the associated payment
          await db
            .delete(payments)
            .where(eq(payments.id, entry[0].referenceId));

          if (sale.length > 0) {
            // Check if there are any remaining payments for this sale
            const remainingPayments = await db
              .select()
              .from(payments)
              .where(eq(payments.saleId, payment[0].saleId));

            if (remainingPayments.length === 0) {
              // No payments left, revert sale status to "Invoiced" if it was "Paid"
              if (sale[0].saleStatus === "Paid") {
                await db
                  .update(sales)
                  .set({ saleStatus: "Invoiced" })
                  .where(eq(sales.id, payment[0].saleId));
              }
            } else {
              // Recalculate total paid and update status
              const totalPaid = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amountReceived), 0);
              const saleTotal = parseFloat(sale[0].totalAmount);
              
              let newStatus = sale[0].saleStatus;
              if (totalPaid >= saleTotal) {
                newStatus = "Paid";
              } else if (sale[0].saleStatus === "Paid") {
                newStatus = "Invoiced";
              }

              if (newStatus !== sale[0].saleStatus) {
                await db
                  .update(sales)
                  .set({ saleStatus: newStatus })
                  .where(eq(sales.id, payment[0].saleId));
              }
            }
          }
        }
      }

      // 3. Delete the cashbook entry itself
      const result = await db
        .delete(cashbook)
        .where(eq(cashbook.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting cashbook entry:", error);
      throw error;
    }
  }

  async getCashBalance(): Promise<number> {
    const [inflowResult, outflowResult] = await Promise.all([
      db.select({
        totalInflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 1), eq(cashbook.isPending, 0))),
      db.select({
        totalOutflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 0), eq(cashbook.isPending, 0)))
    ]);
    
    const totalInflow = inflowResult[0]?.totalInflow || 0;
    const totalOutflow = outflowResult[0]?.totalOutflow || 0;
    
    return totalInflow - totalOutflow;
  }

  async getPendingDebts(): Promise<CashbookEntry[]> {
    return await db
      .select()
      .from(cashbook)
      .where(eq(cashbook.isPending, 1))
      .orderBy(desc(cashbook.transactionDate));
  }

  async getTransactionSummary(): Promise<{
    totalInflow: number;
    totalOutflow: number;
    pendingDebts: number;
    availableBalance: number;
  }> {
    const [inflowResult, outflowResult, pendingResult] = await Promise.all([
      db.select({
        totalInflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 1), eq(cashbook.isPending, 0))),
      db.select({
        totalOutflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 0), eq(cashbook.isPending, 0))),
      db.select({
        pendingDebts: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(eq(cashbook.isPending, 1))
    ]);
    
    const totalInflow = inflowResult[0]?.totalInflow || 0;
    const totalOutflow = outflowResult[0]?.totalOutflow || 0;
    const pendingDebts = pendingResult[0]?.pendingDebts || 0;
    const availableBalance = totalInflow - totalOutflow;
    
    return {
      totalInflow,
      totalOutflow,
      pendingDebts,
      availableBalance
    };
  }

  async markDebtAsPaid(cashbookId: string, paidAmount: number, paymentMethod: string, paymentDate: Date): Promise<CashbookEntry> {
    try {
      // Validate inputs
      if (!cashbookId || !paymentMethod || !paymentDate) {
        throw new Error("Missing required fields: cashbookId, paymentMethod, paymentDate");
      }

      if (paidAmount <= 0) {
        throw new Error("Paid amount must be positive");
      }

      // Get the original debt entry to retrieve its accountHeadId
      const originalDebtEntry = await this.getCashbookEntry(cashbookId);
      if (!originalDebtEntry) {
        throw new Error("Original debt entry not found");
      }

      if (originalDebtEntry.isPending !== 1) {
        throw new Error("Entry is not a pending debt");
      }

      // Update the original debt entry to mark it as not pending
      await db
        .update(cashbook)
        .set({ isPending: 0 })
        .where(eq(cashbook.id, cashbookId));

      // Create a new payment entry
      const paymentEntry = await this.createCashbookEntry({
        transactionDate: paymentDate,
        transactionType: "Supplier Payment",
        category: "Debt Settlement",
        accountHeadId: originalDebtEntry.accountHeadId,
        amount: paidAmount.toFixed(2),
        isInflow: 0, // Outflow since we're paying
        description: `Debt payment for ${originalDebtEntry.counterparty}`,
        paymentMethod,
        referenceType: "debt_payment",
        referenceId: cashbookId,
        isPending: 0,
        counterparty: originalDebtEntry.counterparty,
        notes: `Payment for debt: ${originalDebtEntry.description}`,
      });

      return paymentEntry;
    } catch (error) {
      console.error("Error marking debt as paid:", error);
      throw error;
    }
  }

  async getSalesWithDelays(): Promise<any[]> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        lpoReceivedDate: sales.lpoReceivedDate,
        lpoDueDate: sales.lpoDueDate,
        invoiceDate: sales.invoiceDate,
        saleStatus: sales.saleStatus,
        totalAmount: sales.totalAmount,
        client: clients,
        project: projects
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .orderBy(desc(sales.createdAt));
    
    return result.map(r => {
      const now = new Date();
      let delayDays = 0;
      let delayReason = "";
      
      if (r.saleStatus === "Pending LPO" && r.lpoDueDate) {
        delayDays = Math.floor((now.getTime() - new Date(r.lpoDueDate).getTime()) / (1000 * 60 * 60 * 24));
        delayReason = delayDays > 0 ? `LPO overdue by ${delayDays} days` : `LPO due in ${Math.abs(delayDays)} days`;
      } else if (r.saleStatus === "LPO Received" && r.lpoReceivedDate) {
        delayDays = Math.floor((now.getTime() - new Date(r.lpoReceivedDate).getTime()) / (1000 * 60 * 60 * 24));
        delayReason = `Invoice pending for ${delayDays} days`;
      } else if (r.saleStatus === "Invoiced" && r.invoiceDate) {
        delayDays = Math.floor((now.getTime() - new Date(r.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
        delayReason = `Payment pending for ${delayDays} days`;
      }
      
      return {
        ...r,
        delayDays,
        delayReason,
        client: r.client,
        project: r.project
      };
    });
  }

  async getTotalRevenue(): Promise<number> {
    // Revenue should exclude VAT
    const result = await db.select({ 
      total: sql<number>`COALESCE(SUM(${sales.subtotal}::numeric), 0)` 
    }).from(sales);
    return result[0]?.total || 0;
  }

  async getTotalCOGS(): Promise<number> {
    // COGS should be computed from sales only (quantity * purchase price per sale)
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${sales.quantityGallons}::numeric * ${sales.purchasePricePerGallon}::numeric), 0)`
    }).from(sales);
    return result[0]?.total || 0;
  }

  async getGrossProfit(): Promise<number> {
    const revenue = await this.getTotalRevenue();
    const cogs = await this.getTotalCOGS();
    return revenue - cogs;
  }

  async getPendingLPOCount(): Promise<number> {
    const result = await db.select({ 
      count: sql<number>`COUNT(*)` 
    }).from(sales).where(
      sql`${sales.saleStatus} IN ('Pending LPO', 'LPO Received')`
    );
    return result[0]?.count || 0;
  }

  async getPendingLPOValue(): Promise<number> {
    // Use subtotal (exclude VAT) for pending value
    const result = await db.select({ 
      total: sql<number>`COALESCE(SUM(${sales.subtotal}::numeric), 0)` 
    }).from(sales).where(
      sql`${sales.saleStatus} IN ('Pending LPO', 'LPO Received')`
    );
    return result[0]?.total || 0;
  }

  async updateSale(id: string, saleData: InsertSale): Promise<Sale | undefined> {
    // Calculate VAT and totals
    const quantity = parseFloat(saleData.quantityGallons);
    const pricePerGallon = parseFloat(saleData.salePricePerGallon);
    const purchasePricePerGallon = parseFloat(saleData.purchasePricePerGallon);
    const vatPercentage = parseFloat(saleData.vatPercentage || "5.00");
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalAmount = subtotal + vatAmount;
    const cogs = quantity * purchasePricePerGallon;
    const grossProfit = subtotal - cogs; // Exclude VAT for GP

    // Auto-set invoice date when status changes to "Invoiced"
    let invoiceDate = null;
    if (saleData.saleStatus === "Invoiced" || saleData.saleStatus === "Paid") {
      invoiceDate = new Date();
    }

    const updatedSaleData = {
      ...saleData,
      invoiceDate,
      vatPercentage: vatPercentage.toFixed(2),
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      cogs: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
    };

    const result = await db
      .update(sales)
      .set(updatedSaleData)
      .where(eq(sales.id, id))
      .returning();

    return result[0];
  }

  async getPendingBusinessReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]> {
    let conditions = [sql`${sales.saleStatus} IN ('Pending LPO', 'LPO Received')`];
    
    if (clientId) {
      conditions.push(eq(sales.clientId, clientId));
    }
    
    if (dateFrom) {
      conditions.push(sql`${sales.saleDate} >= ${dateFrom}`);
    }
    
    if (dateTo) {
      conditions.push(sql`${sales.saleDate} <= ${dateTo}`);
    }

    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        purchasePricePerGallon: sales.purchasePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
        lpoDueDate: sales.lpoDueDate,
        invoiceDate: sales.invoiceDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        cogs: sales.cogs,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
        client: clients,
        project: projects
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(sql.join(conditions, sql` AND `))
      .orderBy(desc(sales.createdAt));
    
    return result.map(r => ({
      ...r,
      client: r.client!,
      project: r.project
    }));
  }

  async getVATReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]> {
    let conditions = [sql`${sales.saleStatus} IN ('Invoiced', 'Paid')`];
    
    if (clientId) {
      conditions.push(eq(sales.clientId, clientId));
    }
    
    if (dateFrom) {
      conditions.push(sql`${sales.saleDate} >= ${dateFrom}`);
    }
    
    if (dateTo) {
      conditions.push(sql`${sales.saleDate} <= ${dateTo}`);
    }

    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        purchasePricePerGallon: sales.purchasePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
        lpoDueDate: sales.lpoDueDate,
        invoiceDate: sales.invoiceDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        cogs: sales.cogs,
        grossProfit: sales.grossProfit,
        createdAt: sales.createdAt,
        client: clients,
        project: projects
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(sql.join(conditions, sql` AND `))
      .orderBy(desc(sales.createdAt));
    
    return result.map(r => ({
      ...r,
      client: r.client!,
      project: r.project
    }));
  }

  // Cashbook Payment Allocation methods
  async getCashbookPaymentAllocations(): Promise<CashbookPaymentAllocationWithInvoice[]> {
    const result = await db
      .select({
        id: cashbookPaymentAllocations.id,
        cashbookEntryId: cashbookPaymentAllocations.cashbookEntryId,
        invoiceId: cashbookPaymentAllocations.invoiceId,
        amountAllocated: cashbookPaymentAllocations.amountAllocated,
        createdAt: cashbookPaymentAllocations.createdAt,
        invoice: invoices,
        sale: sales,
        client: clients,
        project: projects,
      })
      .from(cashbookPaymentAllocations)
      .leftJoin(invoices, eq(cashbookPaymentAllocations.invoiceId, invoices.id))
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .orderBy(desc(cashbookPaymentAllocations.createdAt));

    return result.map(r => ({
      ...r,
      invoice: {
        ...r.invoice!,
        sale: {
          ...r.sale!,
          client: r.client!,
          project: r.project!
        }
      }
    }));
  }

  async createCashbookPaymentAllocation(allocation: InsertCashbookPaymentAllocation): Promise<CashbookPaymentAllocation> {
    // Validate that the cashbook entry exists and has sufficient unallocated amount
    const cashbookEntry = await this.getCashbookEntry(allocation.cashbookEntryId);
    if (!cashbookEntry) {
      throw new Error("Cashbook entry not found");
    }

    const cashbookEntryAllocatedAmount = await this.getCashbookEntryAllocatedAmount(allocation.cashbookEntryId);
    const cashbookEntryAmount = parseFloat(cashbookEntry.amount);
    const remainingCashbookAmount = cashbookEntryAmount - cashbookEntryAllocatedAmount;
    const allocationAmount = parseFloat(allocation.amountAllocated);

    if (allocationAmount > remainingCashbookAmount) {
      throw new Error(`Cannot allocate AED ${allocationAmount.toFixed(2)}. Only AED ${remainingCashbookAmount.toFixed(2)} remains unallocated in this cashbook entry.`);
    }

    // Validate that allocation doesn't exceed invoice pending amount
    const invoice = await this.getInvoice(allocation.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const currentAllocatedAmount = await this.getInvoiceAllocatedAmount(allocation.invoiceId);
    const totalAmount = parseFloat(invoice.totalAmount);
    const pendingAmount = totalAmount - currentAllocatedAmount;

    if (allocationAmount > pendingAmount) {
      throw new Error(`Cannot allocate AED ${allocationAmount.toFixed(2)} to invoice ${invoice.invoiceNumber}. Pending amount is only AED ${pendingAmount.toFixed(2)}`);
    }

    // Create the allocation without transaction (for Neon HTTP driver compatibility)
    const allocationResult = await db.insert(cashbookPaymentAllocations).values(allocation).returning();
    
    // Update invoice status if fully paid
    await this.updateInvoiceStatusIfPaid(allocation.invoiceId);
    
    return allocationResult[0];
  }

  async getCashbookPaymentAllocationsByEntry(cashbookEntryId: string): Promise<CashbookPaymentAllocationWithInvoice[]> {
    const result = await db
      .select({
        id: cashbookPaymentAllocations.id,
        cashbookEntryId: cashbookPaymentAllocations.cashbookEntryId,
        invoiceId: cashbookPaymentAllocations.invoiceId,
        amountAllocated: cashbookPaymentAllocations.amountAllocated,
        createdAt: cashbookPaymentAllocations.createdAt,
        invoice: invoices,
        sale: sales,
        client: clients,
        project: projects,
      })
      .from(cashbookPaymentAllocations)
      .leftJoin(invoices, eq(cashbookPaymentAllocations.invoiceId, invoices.id))
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(eq(cashbookPaymentAllocations.cashbookEntryId, cashbookEntryId))
      .orderBy(desc(cashbookPaymentAllocations.createdAt));

    return result.map(r => ({
      ...r,
      invoice: {
        ...r.invoice!,
        sale: {
          ...r.sale!,
          client: r.client!,
          project: r.project!
        }
      }
    }));
  }

  async getPendingInvoicesForAllocation(accountHeadId?: string): Promise<any[]> {
    // If accountHeadId is provided, filter by client
    let clientId: string | undefined;
    if (accountHeadId) {
      // Get the account head to find the client
      const accountHeadResult = await db
        .select()
        .from(accountHeads)
        .where(eq(accountHeads.id, accountHeadId))
        .limit(1);
      
      const accountHead = accountHeadResult[0];
      if (accountHead && accountHead.type === "Client") {
        // Find the client by name (assuming account head name matches client name)
        const clientResult = await db
          .select()
          .from(clients)
          .where(eq(clients.name, accountHead.name))
          .limit(1);
        
        if (clientResult[0]) {
          clientId = clientResult[0].id;
        }
      }
    }

    // Build the query with conditional client filter
    const result = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        saleId: invoices.saleId,
        sale: sales,
        client: clients,
        project: projects
      })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(clientId ? and(eq(invoices.status, "Generated"), eq(sales.clientId, clientId)) : eq(invoices.status, "Generated"));

    // Calculate allocated amounts and build final result
    const invoicesWithAllocations = await Promise.all(
      result.map(async (row) => {
        const allocatedAmount = await this.getInvoiceAllocatedAmount(row.id);
        const pendingAmount = parseFloat(row.totalAmount) - allocatedAmount;
        
        return {
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          invoiceDate: row.invoiceDate,
          totalAmount: row.totalAmount,
          status: row.status,
          allocatedAmount: allocatedAmount,
          pendingAmount: pendingAmount,
          sale: row.sale ? {
            ...row.sale,
            client: row.client,
            project: row.project
          } : null
        };
      })
    );

    // Only return invoices with pending amounts
    return invoicesWithAllocations.filter(invoice => invoice.pendingAmount > 0);
  }

  async getInvoiceAllocatedAmount(invoiceId: string): Promise<number> {
    const result = await db
      .select({
        allocatedAmount: sql<number>`COALESCE(SUM(${cashbookPaymentAllocations.amountAllocated})::numeric, 0)`,
      })
      .from(cashbookPaymentAllocations)
      .where(eq(cashbookPaymentAllocations.invoiceId, invoiceId));

    return result[0]?.allocatedAmount || 0;
  }

  async getCashbookEntryAllocatedAmount(cashbookEntryId: string): Promise<number> {
    const result = await db
      .select({
        allocatedAmount: sql<number>`COALESCE(SUM(${cashbookPaymentAllocations.amountAllocated})::numeric, 0)`,
      })
      .from(cashbookPaymentAllocations)
      .where(eq(cashbookPaymentAllocations.cashbookEntryId, cashbookEntryId));

    return result[0]?.allocatedAmount || 0;
  }

  async updateInvoiceStatusIfPaid(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) return;

    const allocatedAmount = await this.getInvoiceAllocatedAmount(invoiceId);
    const totalAmount = parseFloat(invoice.totalAmount);

    if (allocatedAmount >= totalAmount) {
      await db
        .update(invoices)
        .set({ status: "Paid" })
        .where(eq(invoices.id, invoiceId));
    }
  }

  // Supplier Debt Tracking methods
  async getSupplierDebts(): Promise<CashbookEntryWithAccountHead[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Supplier"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  async getSupplierOutstandingBalance(supplierId: string): Promise<number> {
    const result = await db.select({
      totalDebt: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.accountHeadId} = ${supplierId} AND ${cashbook.isPending} = 1 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`
    }).from(cashbook);
    return result[0]?.totalDebt || 0;
  }

  async getSupplierPaymentHistory(supplierId: string): Promise<CashbookEntry[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Supplier"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  // Client Payment Tracking methods
  async getClientPayments(): Promise<CashbookEntryWithAccountHead[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Client"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  async getClientOutstandingBalance(clientId: string): Promise<number> {
    const result = await db.select({
      totalDebt: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.accountHeadId} = ${clientId} AND ${cashbook.isPending} = 1 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`
    }).from(cashbook);
    return result[0]?.totalDebt || 0;
  }

  async getClientPaymentHistory(clientId: string): Promise<CashbookEntry[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Client"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  async getOverdueClientPayments(daysThreshold: number): Promise<{
    client: Client;
    invoices: Array<{ id: string; invoiceNumber: string | null; invoiceDate: Date | null; pendingAmount: number; totalAmount: number }>;
    totalPending: number;
  }[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Math.max(1, daysThreshold || 30));

    // Fetch candidate invoices that are still not marked Paid
    const rows = await db
      .select({
        invoice: invoices,
        sale: sales,
        client: clients,
      })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id));

    // Compute pending amounts and filter overdue
    const perClient: Record<string, { client: Client; invoices: Array<{ id: string; invoiceNumber: string | null; invoiceDate: Date | null; pendingAmount: number; totalAmount: number }>; totalPending: number }>
      = {};

    for (const r of rows) {
      if (!r.invoice || !r.sale || !r.client) continue;
      // Consider only invoices that are not paid
      if (r.invoice.status === 'Paid') continue;
      // Must have an invoice date
      const invDate = r.invoice.invoiceDate ? new Date(r.invoice.invoiceDate as any) : undefined;
      if (!invDate || invDate > cutoff) continue;

      const allocated = await this.getInvoiceAllocatedAmount(r.invoice.id);
      const totalAmt = parseFloat(r.invoice.totalAmount);
      const pending = totalAmt - allocated;
      if (pending <= 0) continue;

      const clientId = r.client.id;
      if (!perClient[clientId]) {
        perClient[clientId] = { client: r.client, invoices: [], totalPending: 0 };
      }
      perClient[clientId].invoices.push({
        id: r.invoice.id,
        invoiceNumber: r.invoice.invoiceNumber,
        invoiceDate: invDate,
        pendingAmount: parseFloat(pending.toFixed(2)),
        totalAmount: totalAmt,
      });
      perClient[clientId].totalPending = parseFloat((perClient[clientId].totalPending + pending).toFixed(2));
    }

    return Object.values(perClient).sort((a, b) => b.totalPending - a.totalPending);
  }

  // Additional methods for stock update and delete operations

  async updateStock(id: string, stockData: InsertStock): Promise<Stock | undefined> {
    // Calculate VAT and total cost
    const quantity = parseFloat(stockData.quantityGallons);
    const pricePerGallon = parseFloat(stockData.purchasePricePerGallon);
    const vatPercentage = parseFloat(stockData.vatPercentage || "5.00");
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalCost = subtotal + vatAmount;
    
    const updatedStockData = {
      ...stockData,
      vatPercentage: vatPercentage.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalCost: totalCost.toFixed(2)
    };

    const result = await db
      .update(stock)
      .set(updatedStockData)
      .where(eq(stock.id, id))
      .returning();
    
    return result[0];
  }

  async deleteStock(id: string): Promise<boolean> {
    const result = await db
      .delete(stock)
      .where(eq(stock.id, id))
      .returning();
    
    return result.length > 0;
  }

  async deleteSale(id: string): Promise<boolean> {
    try {
      console.log(`Starting deletion of sale: ${id}`);
      
      // Get the sale first to understand what we're deleting
      const sale = await db
        .select()
        .from(sales)
        .where(eq(sales.id, id))
        .limit(1);

      if (sale.length === 0) {
        console.log(`Sale not found: ${id}`);
        return false;
      }

      console.log(`Found sale: ${sale[0].lpoNumber || 'No LPO'} for client`);

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Delete all cashbook payment allocations for invoices of this sale
      const saleInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.saleId, id));

      console.log(`Found ${saleInvoices.length} invoices to delete`);

      for (const invoice of saleInvoices) {
        // Delete allocations for this invoice
        await db
          .delete(cashbookPaymentAllocations)
          .where(eq(cashbookPaymentAllocations.invoiceId, invoice.id));
        console.log(`Deleted cashbook payment allocations for invoice: ${invoice.invoiceNumber}`);
      }

      // 2. Delete all cashbook entries related to payments for this sale
      const salePayments = await db
        .select()
        .from(payments)
        .where(eq(payments.saleId, id));

      console.log(`Found ${salePayments.length} payments to delete`);

      for (const payment of salePayments) {
        // Delete cashbook entries for this payment
        await db
          .delete(cashbook)
          .where(and(
            eq(cashbook.referenceType, "payment"),
            eq(cashbook.referenceId, payment.id)
          ));
        console.log(`Deleted cashbook entry for payment: ${payment.id}`);
      }

      // 3. Delete all payments for this sale
      await db
        .delete(payments)
        .where(eq(payments.saleId, id));
      console.log(`Deleted ${salePayments.length} payments`);

      // 4. Delete all invoices for this sale
      await db
        .delete(invoices)
        .where(eq(invoices.saleId, id));
      console.log(`Deleted ${saleInvoices.length} invoices`);

      // 5. Delete the sale itself
      const result = await db
        .delete(sales)
        .where(eq(sales.id, id))
        .returning();

      console.log(`Sale deletion completed: ${result.length > 0 ? 'SUCCESS' : 'FAILED'}`);
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting sale:", error);
      throw error;
    }
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const result = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);
    
    return result[0];
  }

  async deleteInvoice(id: string): Promise<boolean> {
    try {
      console.log(`Starting deletion of invoice: ${id}`);
      
      // First, get the invoice to check if it exists
      const invoice = await this.getInvoice(id);
      if (!invoice) {
        console.log(`Invoice not found: ${id}`);
        return false;
      }

      console.log(`Found invoice: ${invoice.invoiceNumber} for sale: ${invoice.saleId}`);

      // Check if there are any payments associated with this invoice's sale
      const payments = await this.getPaymentsBySale(invoice.saleId);
      if (payments.length > 0) {
        console.log(`Cannot delete invoice: ${payments.length} payments found for sale ${invoice.saleId}`);
        // If payments exist, we cannot delete the invoice
        throw new Error("Cannot delete invoice: Payments have been made for this sale");
      }

      console.log(`No payments found, proceeding with deletion`);

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      console.log(`Starting invoice deletion process`);
      
      // 1. Delete all cashbook payment allocations for this invoice
      const allocationsDeleted = await db
        .delete(cashbookPaymentAllocations)
        .where(eq(cashbookPaymentAllocations.invoiceId, id));
      console.log(`Deleted cashbook payment allocations`);

      // 2. Delete the invoice from the database
      const deleteResult = await db
        .delete(invoices)
        .where(eq(invoices.id, id))
        .returning();
      console.log(`Deleted invoice: ${deleteResult.length > 0 ? 'SUCCESS' : 'FAILED'}`);

      // 3. Revert the sale status back to "LPO Received" so it can be regenerated
      if (deleteResult.length > 0) {
        const saleUpdate = await db
          .update(sales)
          .set({ saleStatus: "LPO Received" })
          .where(eq(sales.id, invoice.saleId));
        console.log(`Updated sale status to LPO Received`);
      }

      console.log(`Invoice deletion completed: ${deleteResult.length > 0 ? 'SUCCESS' : 'FAILED'}`);
      return deleteResult.length > 0;
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  }



  async deletePayment(id: string): Promise<boolean> {
    try {
      // Get the payment first to understand what we're deleting
      const payment = await db
        .select()
        .from(payments)
        .where(eq(payments.id, id))
        .limit(1);

      if (payment.length === 0) {
        return false;
      }

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Delete all cashbook payment allocations related to this payment's cashbook entry
      const cashbookEntry = await db
        .select()
        .from(cashbook)
        .where(and(
          eq(cashbook.referenceType, "payment"),
          eq(cashbook.referenceId, id)
        ))
        .limit(1);

      if (cashbookEntry.length > 0) {
        // Delete all allocations for this cashbook entry
        await db
          .delete(cashbookPaymentAllocations)
          .where(eq(cashbookPaymentAllocations.cashbookEntryId, cashbookEntry[0].id));
      }

      // 2. Delete the associated cashbook entry
      await db
        .delete(cashbook)
        .where(and(
          eq(cashbook.referenceType, "payment"),
          eq(cashbook.referenceId, id)
        ));

      // 3. Delete the payment
      const result = await db
        .delete(payments)
        .where(eq(payments.id, id))
        .returning();

      // 4. Update sale status if needed
      if (result.length > 0) {
        const sale = await db
          .select()
          .from(sales)
          .where(eq(sales.id, payment[0].saleId))
          .limit(1);

        if (sale.length > 0) {
          // Check if there are any remaining payments for this sale
          const remainingPayments = await db
            .select()
            .from(payments)
            .where(eq(payments.saleId, payment[0].saleId));

          if (remainingPayments.length === 0) {
            // No payments left, revert sale status to "Invoiced" if it was "Paid"
            if (sale[0].saleStatus === "Paid") {
              await db
                .update(sales)
                .set({ saleStatus: "Invoiced" })
                .where(eq(sales.id, payment[0].saleId));
            }
          } else {
            // Recalculate total paid and update status
            const totalPaid = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amountReceived), 0);
            const saleTotal = parseFloat(sale[0].totalAmount);
            
            let newStatus = sale[0].saleStatus;
            if (totalPaid >= saleTotal) {
              newStatus = "Paid";
            } else if (sale[0].saleStatus === "Paid") {
              newStatus = "Invoiced";
            }

            if (newStatus !== sale[0].saleStatus) {
              await db
                .update(sales)
                .set({ saleStatus: newStatus })
                .where(eq(sales.id, payment[0].saleId));
            }
          }
        }
      }

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting payment:", error);
      throw error;
    }
  }

  async migratePaymentsToCashbook(): Promise<number> {
    // Get all payments that don't have corresponding cashbook entries
    const allPayments = await this.getPayments();
    let migratedCount = 0;

    for (const payment of allPayments) {
      // Check if cashbook entry already exists for this payment
      const existingCashbookEntry = await db
        .select()
        .from(cashbook)
        .where(and(
          eq(cashbook.referenceType, "payment"),
          eq(cashbook.referenceId, payment.id)
        ))
        .limit(1);

      if (existingCashbookEntry.length === 0) {
        // Create cashbook entry for this payment
        const client = payment.sale.client;
        
        let clientAccountHead = await db.select().from(accountHeads).where(eq(accountHeads.name, client.name)).limit(1);
        if (!clientAccountHead[0]) {
          clientAccountHead = [await this.createAccountHead({
            name: client.name,
            type: "Client",
          })];
        }

        await this.createCashbookEntry({
          transactionDate: payment.paymentDate,
          transactionType: "Sale Revenue",
          accountHeadId: clientAccountHead[0].id,
          amount: parseFloat(payment.amountReceived).toFixed(2),
          isInflow: 1,
          description: `Payment received from ${client.name} for LPO ${payment.sale.lpoNumber || "N/A"}`,
          counterparty: client.name,
          paymentMethod: payment.paymentMethod,
          referenceType: "payment",
          referenceId: payment.id,
          isPending: 0,
          notes: `Amount: ${payment.amountReceived}`
        });

        migratedCount++;
      }
    }

    return migratedCount;
  }

  async getBusinessSettings(): Promise<BusinessSettings> {
    const result = await db.select().from(businessSettings).limit(1);
    
    if (result.length === 0) {
      // Create default settings if none exist
      const defaultSettings = await db.insert(businessSettings).values({}).returning();
      return defaultSettings[0];
    }
    
    return result[0];
  }

  async updateBusinessSettings(settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings> {
    const existing = await this.getBusinessSettings();
    
    const updated = await db
      .update(businessSettings)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(eq(businessSettings.id, existing.id))
      .returning();
    
    return updated[0];
  }
}

export const storage = new DatabaseStorage();
