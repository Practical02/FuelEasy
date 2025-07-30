import { 
  type User, 
  type InsertUser, 
  type Stock, 
  type InsertStock,
  type Client,
  type InsertClient,
  type Sale,
  type InsertSale,
  type SaleWithClient,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
  type PaymentWithSaleAndClient,
  users,
  stock,
  clients,
  sales,
  invoices,
  payments
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Stock methods
  getStock(): Promise<Stock[]>;
  createStock(stock: InsertStock): Promise<Stock>;
  getCurrentStockLevel(): Promise<number>;
  
  // Client methods
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  
  // Sale methods
  getSales(): Promise<SaleWithClient[]>;
  getSalesByStatus(status: string): Promise<SaleWithClient[]>;
  getSale(id: string): Promise<SaleWithClient | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSaleStatus(id: string, status: string): Promise<Sale | undefined>;
  
  // Invoice methods
  getInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  
  // Payment methods
  getPayments(): Promise<PaymentWithSaleAndClient[]>;
  getPaymentsBySale(saleId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  
  // Reporting methods
  getTotalRevenue(): Promise<number>;
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
    return Array.from(this.stock.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const id = randomUUID();
    const stock: Stock = { 
      ...insertStock, 
      id, 
      createdAt: new Date() 
    };
    this.stock.set(id, stock);
    return stock;
  }

  async getCurrentStockLevel(): Promise<number> {
    const stockEntries = Array.from(this.stock.values());
    const salesEntries = Array.from(this.sales.values());
    
    const totalPurchased = stockEntries.reduce((sum, entry) => 
      sum + parseFloat(entry.quantityGallons), 0);
    
    const totalSold = salesEntries.reduce((sum, sale) => 
      sum + parseFloat(sale.quantityGallons), 0);
    
    return totalPurchased - totalSold;
  }

  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { 
      ...insertClient, 
      id, 
      createdAt: new Date() 
    };
    this.clients.set(id, client);
    return client;
  }

  async getSales(): Promise<SaleWithClient[]> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoDueDate: sales.lpoDueDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        createdAt: sales.createdAt,
        client: clients
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .orderBy(desc(sales.createdAt));
    
    return result.filter(r => r.client).map(r => ({
      ...r,
      client: r.client!
    }));
  }

  async getSalesByStatus(status: string): Promise<SaleWithClient[]> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoDueDate: sales.lpoDueDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        createdAt: sales.createdAt,
        client: clients
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .where(eq(sales.saleStatus, status))
      .orderBy(desc(sales.createdAt));
    
    return result.filter(r => r.client).map(r => ({
      ...r,
      client: r.client!
    }));
  }

  async getSale(id: string): Promise<SaleWithClient | undefined> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        saleDate: sales.saleDate,
        quantityGallons: sales.quantityGallons,
        salePricePerGallon: sales.salePricePerGallon,
        lpoNumber: sales.lpoNumber,
        lpoDueDate: sales.lpoDueDate,
        saleStatus: sales.saleStatus,
        vatPercentage: sales.vatPercentage,
        subtotal: sales.subtotal,
        vatAmount: sales.vatAmount,
        totalAmount: sales.totalAmount,
        createdAt: sales.createdAt,
        client: clients
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .where(eq(sales.id, id))
      .limit(1);
    
    if (result[0]?.client) {
      return {
        ...result[0],
        client: result[0].client
      };
    }
    return undefined;
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    // Calculate totals
    const quantity = parseFloat(insertSale.quantityGallons);
    const pricePerGallon = parseFloat(insertSale.salePricePerGallon);
    const vatPercentage = insertSale.vatPercentage ? parseFloat(insertSale.vatPercentage) : 5.0;
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalAmount = subtotal + vatAmount;
    
    const saleData = {
      ...insertSale,
      saleStatus: insertSale.saleStatus || "Pending LPO",
      vatPercentage: insertSale.vatPercentage || "5.00",
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    };
    
    const result = await db.insert(sales).values(saleData).returning();
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

  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const result = await db.insert(invoices).values(insertInvoice).returning();
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
    
    // Check if sale is fully paid and update status
    const [saleResult, paymentsResult] = await Promise.all([
      db.select().from(sales).where(eq(sales.id, insertPayment.saleId)).limit(1),
      this.getPaymentsBySale(insertPayment.saleId)
    ]);
    
    if (saleResult[0]) {
      const totalPaid = paymentsResult.reduce((sum, p) => 
        sum + parseFloat(p.amountReceived), 0);
      
      const saleTotal = parseFloat(saleResult[0].totalAmount);
      
      if (totalPaid >= saleTotal) {
        await this.updateSaleStatus(insertPayment.saleId, "Paid");
      }
    }
    
    return payment;
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
}

export const storage = new MemStorage();
