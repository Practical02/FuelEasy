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
  type Project
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
  private projects: Map<string, Project>;
  private sales: Map<string, Sale>;
  private invoices: Map<string, Invoice>;
  private payments: Map<string, Payment>;

  constructor() {
    this.users = new Map();
    this.stock = new Map();
    this.clients = new Map();
    this.projects = new Map();
    this.sales = new Map();
    this.invoices = new Map();
    this.payments = new Map();
    
    // Initialize with test data
    this.initializeTestData();
  }

  private initializeTestData() {
    // Add test clients
    const client1: Client = {
      id: "client-1",
      name: "Emirates Transport Co.",
      contactPerson: "Ahmed Al-Rashid",
      phoneNumber: "+971-50-123-4567",
      email: "ahmed@emiratestransport.ae",
      address: "Al Qusais Industrial Area, Dubai, UAE",
      createdAt: new Date("2025-01-10T08:00:00Z")
    };
    
    const client2: Client = {
      id: "client-2", 
      name: "Dubai Logistics LLC",
      contactPerson: "Fatima Hassan",
      phoneNumber: "+971-55-987-6543",
      email: "fatima@dubailogistics.com",
      address: "Jebel Ali Free Zone, Dubai, UAE",
      createdAt: new Date("2025-01-12T09:30:00Z")
    };
    
    const client3: Client = {
      id: "client-3",
      name: "Al Futtaim Motors",
      contactPerson: "Mohammed bin Saeed", 
      phoneNumber: "+971-52-111-2222",
      email: "mohammed@alfuttaim.ae",
      address: "Sheikh Zayed Road, Dubai, UAE",
      createdAt: new Date("2025-01-14T10:15:00Z")
    };
    
    this.clients.set(client1.id, client1);
    this.clients.set(client2.id, client2);
    this.clients.set(client3.id, client3);

    // Add test projects
    const project1: Project = {
      id: "project-1",
      clientId: "client-1",
      name: "Fleet Fueling Contract",
      description: "Ongoing fuel supply for Emirates Transport Co. fleet.",
      location: "Dubai",
      status: "Active",
      createdAt: new Date("2025-01-10T09:00:00Z"),
    };
    const project2: Project = {
      id: "project-2",
      clientId: "client-2",
      name: "Warehouse Generator Supply",
      description: "Diesel supply for backup generators at Jebel Ali warehouse.",
      location: "Jebel Ali",
      status: "Completed",
      createdAt: new Date("2025-01-12T10:00:00Z"),
    };
    const project3: Project = {
      id: "project-3",
      clientId: "client-3",
      name: "Showroom Heating Oil",
      description: "Seasonal heating oil supply for Al Futtaim Motors showrooms.",
      location: "Abu Dhabi",
      status: "On Hold",
      createdAt: new Date("2025-01-14T11:00:00Z"),
    };
    this.projects.set(project1.id, project1);
    this.projects.set(project2.id, project2);
    this.projects.set(project3.id, project3);

    // Add test stock with VAT
    const stock1: Stock = {
      id: "stock-1",
      purchaseDate: new Date("2025-01-15T08:00:00Z"),
      quantityGallons: "5000.00",
      purchasePricePerGallon: "2.850",
      vatPercentage: "5.00",
      vatAmount: "712.50",
      totalCost: "14962.50",
      createdAt: new Date("2025-01-15T08:30:00Z")
    };
    
    const stock2: Stock = {
      id: "stock-2",
      purchaseDate: new Date("2025-01-20T09:30:00Z"),
      quantityGallons: "3500.00",
      purchasePricePerGallon: "2.820",
      vatPercentage: "5.00",
      vatAmount: "493.50",
      totalCost: "10363.50",
      createdAt: new Date("2025-01-20T10:00:00Z")
    };
    
    const stock3: Stock = {
      id: "stock-3",
      purchaseDate: new Date("2025-01-28T07:45:00Z"),
      quantityGallons: "2000.00",
      purchasePricePerGallon: "2.875",
      vatPercentage: "5.00",
      vatAmount: "287.50",
      totalCost: "6037.50",
      createdAt: new Date("2025-01-28T08:15:00Z")
    };
    
    this.stock.set(stock1.id, stock1);
    this.stock.set(stock2.id, stock2);
    this.stock.set(stock3.id, stock3);

    // Add test sales
    const sale1: Sale = {
      id: "sale-1",
      clientId: "client-1",
      projectId: "project-1",
      saleDate: new Date("2025-01-22T10:00:00Z"),
      quantityGallons: "1500.00",
      salePricePerGallon: "3.200",
      purchasePricePerGallon: "2.800",
      lpoNumber: "LPO-EMT-2025-001",
      lpoReceivedDate: new Date("2025-01-22T09:00:00Z"),
      lpoDueDate: new Date("2025-02-15T23:59:59Z"),
      invoiceDate: null,
      saleStatus: "LPO Received",
      vatPercentage: "5.00",
      subtotal: "4800.00",
      vatAmount: "240.00", 
      totalAmount: "5040.00",
      cogs: "4200.00",
      grossProfit: "600.00",
      createdAt: new Date("2025-01-22T10:30:00Z")
    };
    
    const sale2: Sale = {
      id: "sale-2",
      clientId: "client-2",
      projectId: "project-2",
      saleDate: new Date("2025-01-25T14:30:00Z"),
      quantityGallons: "2200.00",
      salePricePerGallon: "3.150",
      purchasePricePerGallon: "2.750",
      lpoNumber: "LPO-DUB-2025-012",
      lpoReceivedDate: new Date("2025-01-25T13:00:00Z"),
      lpoDueDate: new Date("2025-02-20T23:59:59Z"),
      invoiceDate: new Date("2025-01-26T09:00:00Z"),
      saleStatus: "Invoiced",
      vatPercentage: "5.00",
      subtotal: "6930.00",
      vatAmount: "346.50",
      totalAmount: "7276.50",
      cogs: "6050.00",
      grossProfit: "880.00",
      createdAt: new Date("2025-01-25T15:00:00Z")
    };
    
    const sale3: Sale = {
      id: "sale-3",
      clientId: "client-3",
      projectId: "project-3",
      saleDate: new Date("2025-01-30T11:15:00Z"),
      quantityGallons: "800.00",
      salePricePerGallon: "3.180",
      purchasePricePerGallon: "2.850",
      lpoNumber: "LPO-ALF-2025-005",
      lpoReceivedDate: null,
      lpoDueDate: new Date("2025-02-25T23:59:59Z"),
      invoiceDate: null,
      saleStatus: "Pending LPO",
      vatPercentage: "5.00",
      subtotal: "2544.00",
      vatAmount: "127.20",
      totalAmount: "2671.20",
      cogs: "2280.00",
      grossProfit: "264.00",
      createdAt: new Date("2025-01-30T11:45:00Z")
    };
    
    this.sales.set(sale1.id, sale1);
    this.sales.set(sale2.id, sale2);
    this.sales.set(sale3.id, sale3);

    // Add test payment
    const payment1: Payment = {
      id: "payment-1",
      saleId: "sale-2",
      paymentDate: new Date("2025-01-28T16:00:00Z"),
      amountReceived: "7276.50",
      paymentMethod: "Bank Transfer",
      chequeNumber: null,
      createdAt: new Date("2025-01-28T16:30:00Z")
    };
    
    this.payments.set(payment1.id, payment1);
    
    // Update sale2 status to Paid since it has full payment
    this.sales.get("sale-2")!.saleStatus = "Paid";
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
    
    // Calculate VAT and total cost automatically
    const quantity = parseFloat(insertStock.quantityGallons);
    const pricePerGallon = parseFloat(insertStock.purchasePricePerGallon);
    const vatPercentage = parseFloat(insertStock.vatPercentage || "5.00");
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalCost = subtotal + vatAmount;
    
    const stock: Stock = { 
      ...insertStock, 
      id, 
      vatPercentage: vatPercentage.toString(),
      vatAmount: vatAmount.toString(),
      totalCost: totalCost.toString(),
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
      const project = sale.projectId ? this.projects.get(sale.projectId) : null;
      if (client) {
        salesWithClients.push({ ...sale, client, project: project || null, cogs: sale.cogs, grossProfit: sale.grossProfit });
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
    if (!sale) { return undefined; }
    
    const client = this.clients.get(sale.clientId);
    const project = sale.projectId ? this.projects.get(sale.projectId) : null;
    if (!client) { return undefined; }
    
    return sale && client ? { ...sale, client, project: project ?? null } : undefined;
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
    const cogs = quantity * parseFloat(insertSale.purchasePricePerGallon);
    const grossProfit = subtotal - cogs; // exclude VAT
    
    const sale: Sale = { 
      ...insertSale, 
      id,
      lpoNumber: insertSale.lpoNumber ?? null,
      lpoReceivedDate: insertSale.lpoReceivedDate ?? null,
      lpoDueDate: insertSale.lpoDueDate ?? null,
      invoiceDate: insertSale.invoiceDate || null,
      saleStatus: insertSale.saleStatus || "Pending LPO",
      vatPercentage: vatPercentage.toFixed(2),
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      cogs: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      createdAt: new Date() 
    };
    
    this.sales.set(id, sale);
    return sale;
  }

  async updateSale(id: string, saleData: InsertSale): Promise<Sale | undefined> {
    const existingSale = this.sales.get(id);
    if (!existingSale) { return undefined; }
    
    // Calculate totals
    const quantity = parseFloat(saleData.quantityGallons);
    const pricePerGallon = parseFloat(saleData.salePricePerGallon);
    const purchasePricePerGallon = parseFloat(saleData.purchasePricePerGallon);
    const vatPercentage = parseFloat(saleData.vatPercentage || "5.00");
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalAmount = subtotal + vatAmount;
    const cogs = quantity * purchasePricePerGallon;
    const grossProfit = subtotal - cogs; // exclude VAT
    
    const updatedSale: Sale = {
      ...existingSale,
      ...saleData,
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      cogs: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      invoiceDate: saleData.saleStatus === "Invoiced" || saleData.saleStatus === "Paid" 
        ? (existingSale.invoiceDate || new Date()) 
        : existingSale.invoiceDate,
    };
    
    this.sales.set(id, updatedSale);
    return updatedSale;
  }

  async updateSaleStatus(id: string, status: string): Promise<Sale | undefined> {
    const sale = this.sales.get(id);
    if (!sale) { return undefined; }
    
    const updatedSale = { 
      ...sale, 
      saleStatus: status,
      invoiceDate: status === "Invoiced" && !sale.invoiceDate ? new Date() : sale.invoiceDate
    };
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
    // Revenue excludes VAT
    return salesArray.reduce((sum, sale) => sum + parseFloat(sale.subtotal), 0);
  }

  async getTotalCOGS(): Promise<number> {
    const salesArray = Array.from(this.sales.values());
    // COGS from sales only: quantity * purchase price per sale
    return salesArray.reduce((sum, sale) => sum + (parseFloat(sale.quantityGallons) * parseFloat(sale.purchasePricePerGallon)), 0);
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

  async getPendingBusinessReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]> {
    const allSales = await this.getSales();
    
    return allSales.filter(sale => {
      // Filter by pending status only
      const isPending = sale.saleStatus === "Pending LPO" || sale.saleStatus === "LPO Received" || sale.saleStatus === "Invoiced";
      if (!isPending) { return false; }

      // Filter by client if specified
      if (clientId && clientId !== "all" && sale.clientId !== clientId) {
        return false;
      }

      // Filter by date range if specified
      const saleDate = new Date(sale.saleDate);
      if (dateFrom && saleDate < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && saleDate > new Date(dateTo)) {
        return false;
      }

      return true;
    });
  }

  async getVATReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]> {
    const allSales = await this.getSales();
    
    return allSales.filter(sale => {
      // Filter by client if specified
      if (clientId && clientId !== "all" && sale.clientId !== clientId) {
        return false;
      }

      // Filter by date range if specified
      const saleDate = new Date(sale.saleDate);
      if (dateFrom && saleDate < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && saleDate > new Date(dateTo)) {
        return false;
      }

      return true;
    });
  }
}

export const storage = new MemStorage();