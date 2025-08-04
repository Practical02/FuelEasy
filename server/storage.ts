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
  users,
  stock,
  clients,
  projects,
  sales,
  invoices,
  payments,
  cashbook
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, sql } from "drizzle-orm";

// Initialize database connection
const connectionString = process.env.DATABASE_URL || "";
const sql_conn = neon(connectionString);
const db = drizzle(sql_conn, { schema: { users, stock, clients, projects, sales, invoices, payments, cashbook } });

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
  
  // Cashbook methods
  getCashbookEntries(): Promise<CashbookEntry[]>;
  getCashbookEntry(id: string): Promise<CashbookEntry | undefined>;
  createCashbookEntry(entry: InsertCashbook): Promise<CashbookEntry>;
  deleteCashbookEntry(id: string): Promise<boolean>;
  getCashBalance(): Promise<number>;
  
  // Reporting methods
  getTotalRevenue(): Promise<number>;
  getSalesWithDelays(): Promise<any[]>;
  getTotalCOGS(): Promise<number>;
  getGrossProfit(): Promise<number>;
  getPendingLPOCount(): Promise<number>;
  getPendingLPOValue(): Promise<number>;
  getPendingBusinessReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]>;
  getVATReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private stock: Map<string, Stock>;
  private clients: Map<string, Client>;
  private sales: Map<string, Sale>;
  private invoices: Map<string, Invoice>;
  private payments: Map<string, Payment>;

  constructor() {
    this.users = new Map();
    this.stock = new Map();
    this.clients = new Map();
    this.sales = new Map();
    this.invoices = new Map();
    this.payments = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
    
    // Create cashbook entry for stock purchase (as debt)
    await db.insert(cashbook).values({
      transactionDate: insertStock.purchaseDate,
      transactionType: "Stock Purchase",
      amount: totalCost.toFixed(2),
      isInflow: 0, // Outflow since we're purchasing
      description: `Stock purchase: ${quantity} gallons at ${pricePerGallon} AED/gallon`,
      counterparty: "Supplier",
      paymentMethod: "Credit", // Default to credit (debt)
      referenceType: "stock",
      referenceId: result[0].id,
      isPending: 1, // Mark as pending debt by default
      notes: `VAT: ${vatAmount} AED (${vatPercentage}%)`
    });
    
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
    return result[0];
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
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
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
    const grossProfit = totalAmount - cogs;
    
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
  async getCashbookEntries(): Promise<CashbookEntry[]> {
    return await db.select().from(cashbook).orderBy(desc(cashbook.createdAt));
  }

  async getCashbookEntry(id: string): Promise<CashbookEntry | undefined> {
    const result = await db.select().from(cashbook).where(eq(cashbook.id, id)).limit(1);
    return result[0];
  }

  async createCashbookEntry(insertCashbook: InsertCashbook): Promise<CashbookEntry> {
    const result = await db.insert(cashbook).values(insertCashbook).returning();
    return result[0];
  }

  async deleteCashbookEntry(id: string): Promise<boolean> {
    const result = await db.delete(cashbook).where(eq(cashbook.id, id)).returning();
    return result.length > 0;
  }

  async getCashBalance(): Promise<number> {
    const result = await db.select({
      totalInflow: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.isInflow} = 1 AND ${cashbook.isPending} = 0 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`,
      totalOutflow: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.isInflow} = 0 AND ${cashbook.isPending} = 0 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`
    }).from(cashbook);
    
    const totalInflow = result[0]?.totalInflow || 0;
    const totalOutflow = result[0]?.totalOutflow || 0;
    
    return totalInflow - totalOutflow;
  }

  async getPendingDebts(): Promise<CashbookEntry[]> {
    return await db.select().from(cashbook)
      .where(eq(cashbook.isPending, 1))
      .orderBy(desc(cashbook.transactionDate));
  }

  async getTransactionSummary(): Promise<{
    totalInflow: number;
    totalOutflow: number;
    pendingDebts: number;
    availableBalance: number;
  }> {
    const [summaryResult, pendingResult] = await Promise.all([
      db.select({
        totalInflow: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.isInflow} = 1 AND ${cashbook.isPending} = 0 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`,
        totalOutflow: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.isInflow} = 0 AND ${cashbook.isPending} = 0 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`
      }).from(cashbook),
      db.select({
        pendingDebts: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.isPending} = 1 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`
      }).from(cashbook)
    ]);
    
    const totalInflow = summaryResult[0]?.totalInflow || 0;
    const totalOutflow = summaryResult[0]?.totalOutflow || 0;
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
    // Update the original debt entry
    await db.update(cashbook)
      .set({ isPending: 0 })
      .where(eq(cashbook.id, cashbookId));

    // Create a new payment entry
    const paymentEntry = await db.insert(cashbook).values({
      transactionDate: paymentDate,
      transactionType: "Stock Payment",
      amount: paidAmount.toFixed(2),
      isInflow: 0, // Outflow since we're paying
      description: "Debt payment for stock purchase",
      paymentMethod,
      referenceType: "debt_payment",
      referenceId: cashbookId,
      isPending: 0,
      counterparty: "Supplier"
    }).returning();

    return paymentEntry[0];
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
    const result = await db.select({ 
      total: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)` 
    }).from(sales);
    return result[0]?.total || 0;
  }

  async getTotalCOGS(): Promise<number> {
    const [stockResult, salesResult] = await Promise.all([
      db.select({
        totalCost: sql<number>`COALESCE(SUM(${stock.quantityGallons}::numeric * ${stock.purchasePricePerGallon}::numeric), 0)`,
        totalQuantity: sql<number>`COALESCE(SUM(${stock.quantityGallons}::numeric), 0)`
      }).from(stock),
      db.select({
        totalSold: sql<number>`COALESCE(SUM(${sales.quantityGallons}::numeric), 0)`
      }).from(sales)
    ]);
    
    const totalCost = stockResult[0]?.totalCost || 0;
    const totalQuantity = stockResult[0]?.totalQuantity || 0;
    const totalSold = salesResult[0]?.totalSold || 0;
    
    if (totalQuantity === 0) return 0;
    
    const avgCostPerGallon = totalCost / totalQuantity;
    return totalSold * avgCostPerGallon;
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
    const result = await db.select({ 
      total: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)` 
    }).from(sales).where(
      sql`${sales.saleStatus} IN ('Pending LPO', 'LPO Received')`
    );
    return result[0]?.total || 0;
  }

  async updateSale(id: string, saleData: InsertSale): Promise<Sale | undefined> {
    // Calculate VAT and totals
    const quantity = parseFloat(saleData.quantityGallons);
    const pricePerGallon = parseFloat(saleData.salePricePerGallon);
    const vatPercentage = parseFloat(saleData.vatPercentage || "5.00");
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalAmount = subtotal + vatAmount;

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
    const result = await db
      .delete(sales)
      .where(eq(sales.id, id))
      .returning();
    
    return result.length > 0;
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
    const result = await db
      .update(invoices)
      .set({ status: "Deleted" })
      .where(eq(invoices.id, id))
      .returning();

    return result.length > 0;
  }

  async regenerateInvoice(invoiceId: string): Promise<Invoice | undefined> {
    const originalInvoice = await this.getInvoice(invoiceId);
    if (!originalInvoice) {
      return undefined;
    }

    const newInvoiceData: InsertInvoice = {
      ...originalInvoice,
      status: "pending", 
    };

    const newInvoice = await this.createInvoice(newInvoiceData);
    return newInvoice;
  }

  async deletePayment(id: string): Promise<boolean> {
    const result = await db
      .delete(payments)
      .where(eq(payments.id, id))
      .returning();
    
    return result.length > 0;
  }
}

export const storage = new MemStorage();
