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
  type PaymentWithSaleAndClient
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;

  // Stock methods  
  getStock(): Promise<Stock[]>;
  createStock(insertStock: InsertStock): Promise<Stock>;
  getCurrentStockLevel(): Promise<number>;

  // Client methods
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(insertClient: InsertClient): Promise<Client>;

  // Sale methods
  getSales(): Promise<SaleWithClient[]>;
  getSalesByStatus(status: string): Promise<SaleWithClient[]>;
  getSale(id: string): Promise<SaleWithClient | undefined>;
  createSale(insertSale: InsertSale): Promise<Sale>;
  updateSaleStatus(id: string, status: string): Promise<Sale | undefined>;

  // Invoice methods
  getInvoices(): Promise<Invoice[]>;
  createInvoice(insertInvoice: InsertInvoice): Promise<Invoice>;

  // Payment methods
  getPayments(): Promise<PaymentWithSaleAndClient[]>;
  getPaymentsBySale(saleId: string): Promise<Payment[]>;
  createPayment(insertPayment: InsertPayment): Promise<Payment>;

  // Analytics methods
  getTotalRevenue(): Promise<number>;
  getTotalCOGS(): Promise<number>;
  getGrossProfit(): Promise<number>;
  getPendingLPOCount(): Promise<number>;
  getPendingLPOValue(): Promise<number>;
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
    const salesArray = Array.from(this.sales.values());
    const salesWithClients: SaleWithClient[] = [];
    
    for (const sale of salesArray) {
      const client = this.clients.get(sale.clientId);
      if (client) {
        salesWithClients.push({ ...sale, client });
      }
    }
    
    return salesWithClients.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getSalesByStatus(status: string): Promise<SaleWithClient[]> {
    const allSales = await this.getSales();
    return allSales.filter(sale => sale.saleStatus === status);
  }

  async getSale(id: string): Promise<SaleWithClient | undefined> {
    const sale = this.sales.get(id);
    if (!sale) return undefined;
    
    const client = this.clients.get(sale.clientId);
    if (!client) return undefined;
    
    return { ...sale, client };
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    
    // Calculate totals
    const quantity = parseFloat(insertSale.quantityGallons);
    const pricePerGallon = parseFloat(insertSale.salePricePerGallon);
    const vatPercentage = insertSale.vatPercentage ? parseFloat(insertSale.vatPercentage) : 5.0;
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalAmount = subtotal + vatAmount;
    
    const sale: Sale = { 
      ...insertSale, 
      id,
      saleStatus: insertSale.saleStatus || "Pending LPO",
      vatPercentage: insertSale.vatPercentage || "5.00",
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      createdAt: new Date() 
    };
    
    this.sales.set(id, sale);
    return sale;
  }

  async updateSaleStatus(id: string, status: string): Promise<Sale | undefined> {
    const sale = this.sales.get(id);
    if (!sale) return undefined;
    
    const updatedSale = { ...sale, saleStatus: status };
    this.sales.set(id, updatedSale);
    return updatedSale;
  }

  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const invoice: Invoice = { 
      ...insertInvoice, 
      id,
      status: insertInvoice.status || "Generated",
      createdAt: new Date() 
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async getPayments(): Promise<PaymentWithSaleAndClient[]> {
    const paymentsArray = Array.from(this.payments.values());
    const paymentsWithDetails: PaymentWithSaleAndClient[] = [];
    
    for (const payment of paymentsArray) {
      const sale = this.sales.get(payment.saleId);
      if (sale) {
        const client = this.clients.get(sale.clientId);
        if (client) {
          paymentsWithDetails.push({ 
            ...payment, 
            sale: { ...sale, client } 
          });
        }
      }
    }
    
    return paymentsWithDetails.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getPaymentsBySale(saleId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      payment => payment.saleId === saleId
    );
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = { 
      ...insertPayment, 
      id,
      chequeNumber: insertPayment.chequeNumber || null,
      createdAt: new Date() 
    };
    this.payments.set(id, payment);
    
    // Check if sale is fully paid and update status
    const sale = this.sales.get(insertPayment.saleId);
    if (sale) {
      const salePayments = await this.getPaymentsBySale(insertPayment.saleId);
      const totalPaid = salePayments.reduce((sum, p) => 
        sum + parseFloat(p.amountReceived), 0) + parseFloat(insertPayment.amountReceived);
      
      const saleTotal = parseFloat(sale.totalAmount);
      
      if (totalPaid >= saleTotal) {
        await this.updateSaleStatus(insertPayment.saleId, "Paid");
      }
    }
    
    return payment;
  }

  async getTotalRevenue(): Promise<number> {
    const salesArray = Array.from(this.sales.values());
    return salesArray.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }

  async getTotalCOGS(): Promise<number> {
    const salesArray = Array.from(this.sales.values());
    const stockArray = Array.from(this.stock.values());
    
    if (stockArray.length === 0) return 0;
    
    // Calculate weighted average cost per gallon
    const totalCost = stockArray.reduce((sum, stock) => 
      sum + (parseFloat(stock.quantityGallons) * parseFloat(stock.purchasePricePerGallon)), 0);
    const totalQuantity = stockArray.reduce((sum, stock) => 
      sum + parseFloat(stock.quantityGallons), 0);
    
    const avgCostPerGallon = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    
    // Calculate COGS based on sold quantities
    const totalSoldQuantity = salesArray.reduce((sum, sale) => 
      sum + parseFloat(sale.quantityGallons), 0);
    
    return totalSoldQuantity * avgCostPerGallon;
  }

  async getGrossProfit(): Promise<number> {
    const revenue = await this.getTotalRevenue();
    const cogs = await this.getTotalCOGS();
    return revenue - cogs;
  }

  async getPendingLPOCount(): Promise<number> {
    const salesArray = Array.from(this.sales.values());
    return salesArray.filter(sale => 
      sale.saleStatus === "Pending LPO" || sale.saleStatus === "LPO Received"
    ).length;
  }

  async getPendingLPOValue(): Promise<number> {
    const salesArray = Array.from(this.sales.values());
    return salesArray
      .filter(sale => sale.saleStatus === "Pending LPO" || sale.saleStatus === "LPO Received")
      .reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }
}

export const storage = new MemStorage();