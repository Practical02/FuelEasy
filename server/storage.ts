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
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, sql, desc } from "drizzle-orm";

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
}

// Database setup
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(connectionString);
const db = drizzle(sql);

export class DbStorage implements IStorage {
  constructor() {}
  
  async init() {
    // Database tables are automatically created by Drizzle migrations
    console.log("Database storage initialized");
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
    const result = await db.insert(stock).values(insertStock).returning();
    return result[0];
  }

  async getCurrentStockLevel(): Promise<number> {
    const [stockResult, salesResult] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(${stock.quantityGallons}::numeric), 0)` }).from(stock),
      db.select({ total: sql<number>`COALESCE(SUM(${sales.quantityGallons}::numeric), 0)` }).from(sales)
    ]);
    
    const totalPurchased = stockResult[0]?.total || 0;
    const totalSold = salesResult[0]?.total || 0;
    
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
    const result = await db
      .select({
        id: payments.id,
        saleId: payments.saleId,
        amount: payments.amountReceived,
        paymentMethod: payments.paymentMethod,
        chequeNumber: payments.chequeNumber,
        paymentDate: payments.paymentDate,
        createdAt: payments.createdAt,
        sale: {
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
        }
      })
      .from(payments)
      .leftJoin(sales, eq(payments.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .orderBy(desc(payments.createdAt));
    
    return result.filter(r => r.sale && r.sale.client).map(r => ({
      ...r,
      sale: {
        ...r.sale!,
        client: r.sale!.client!
      }
    }));
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

export const storage = new DbStorage();
