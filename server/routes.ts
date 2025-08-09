import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { 
  insertStockSchema, 
  insertClientSchema, 
  insertSaleSchema, 
  type InsertSale,
  insertPaymentSchema,
  insertInvoiceSchema,
  insertProjectSchema,
  insertCashbookSchema,
  insertAccountHeadSchema,
  insertCashbookPaymentAllocationSchema,
  insertSupplierAdvanceAllocationSchema,
  insertBusinessSettingsSchema
} from "@shared/schema";
import "./types/session";

// Simple in-memory cache for read operations
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

function getCacheKey(req: any): string {
  return `${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.session?.userId || 'anonymous'}`;
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCache(key: string, data: any, ttlMs: number = 60000): void {
  // Limit cache size to prevent memory issues
  if (cache.size > 1000) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

function clearCachePattern(pattern: string): void {
  Array.from(cache.keys()).forEach((key) => {
    if (key.includes(pattern)) cache.delete(key);
  });
}

// Cache middleware for GET requests
function cacheMiddleware(ttlMs: number = 60000) {
  return (req: any, res: any, next: any) => {
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = getCacheKey(req);
    const cachedData = getFromCache(cacheKey);
    
    if (cachedData) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data: any) {
      setCache(cacheKey, data, ttlMs);
      res.set('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };
    
    next();
  };
}

const apiInsertSaleSchema = insertSaleSchema.extend({
  quantityGallons: z.number(),
  salePricePerGallon: z.number(),
  purchasePricePerGallon: z.number(),
});

const apiInsertPaymentSchema = insertPaymentSchema.extend({
  amountReceived: z.number(),
});

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Login schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Rate limiters
  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts, please try again later." },
  });
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please slow down." },
  });
  
  // Health check endpoints
  app.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: "1.0.0"
    });
  });

  app.get("/api/health", async (req, res) => {
    try {
      // Test database connection
      const settings = await storage.getBusinessSettings();
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: "1.0.0",
        database: "connected",
        hasSession: !!req.session,
        vercel: process.env.VERCEL
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({ 
        status: "error", 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: "1.0.0",
        database: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Authentication routes
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { username, password, rememberMe } = loginSchema.parse(req.body);

      // Find user by username
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if session exists
      if (!req.session) {
        console.error("No session available");
        return res.status(500).json({ message: "Session initialization failed" });
      }

      // Set session with extended duration if rememberMe is true
      req.session.userId = user.id;
      req.session.username = user.username;
      
      // Extend session duration for remember me (supports both express-session and cookie-session)
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const oneDay = 24 * 60 * 60 * 1000;
      const desiredMaxAge = rememberMe ? thirtyDays : oneDay;
      if ((req as any).sessionOptions) {
        (req as any).sessionOptions.maxAge = desiredMaxAge;
      } else if ((req.session as any)?.cookie) {
        (req.session as any).cookie.maxAge = desiredMaxAge;
      }

      // Set explicit cookie attributes for cross-site in production
      if (process.env.NODE_ENV === 'production') {
        try {
          const setCookieHeader = res.getHeader('Set-Cookie');
          if (!setCookieHeader) {
            // force a re-set by touching session
            req.session.userId = user.id;
          }
        } catch {}
      }

      res.json({ 
        message: "Login successful", 
        user: { id: user.id, username: user.username },
        expiresIn: rememberMe ? '30 days' : '1 day'
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Login error:", error);
        console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');
      }
      res.status(500).json({ 
        message: "Login failed", 
        error: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const sess: any = req.session as any;
    if (typeof sess?.destroy === 'function') {
      sess.destroy((err: any) => {
        if (err) {
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.json({ message: "Logout successful" });
      });
    } else {
      // cookie-session path
      (req as any).session = null;
      res.json({ message: "Logout successful" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    res.json({
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  });
  
  // Stock routes
  app.get("/api/stock", requireAuth, cacheMiddleware(2 * 60 * 1000), async (req, res) => {
    try {
      const stock = await storage.getStock();
      res.json(stock);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/stock", requireAuth, writeLimiter, async (req, res) => {
    // Clear stock-related cache on write operations
    clearCachePattern('/api/stock');
    try {
      console.log("Received stock data:", JSON.stringify(req.body, null, 2));
      
      // Convert purchaseDate string to Date object
      const requestData = {
        ...req.body,
        purchaseDate: new Date(req.body.purchaseDate)
      };
      
      const stockData = insertStockSchema.parse(requestData);
      console.log("Parsed stock data:", JSON.stringify(stockData, null, 2));
      const stock = await storage.createStock(stockData);
      res.json(stock);
    } catch (error) {
      console.error("Stock validation error:", error);
      res.status(400).json({ message: "Invalid stock data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/stock/current-level", requireAuth, async (req, res) => {
    try {
      const level = await storage.getCurrentStockLevel();
      res.json({ currentLevel: level });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current stock level", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/stock/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        purchaseDate: new Date(req.body.purchaseDate)
      };
      const stockData = insertStockSchema.parse(requestData);
      const stock = await storage.updateStock(req.params.id, stockData);
      if (!stock) {
        return res.status(404).json({ message: "Stock entry not found" });
      }
      res.json(stock);
    } catch (error) {
      res.status(400).json({ message: "Invalid stock data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/stock/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const success = await storage.deleteStock(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Stock entry not found" });
      }
      res.json({ message: "Stock entry deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete stock entry", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Client routes
  app.get("/api/clients", requireAuth, cacheMiddleware(5 * 60 * 1000), async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/clients", requireAuth, writeLimiter, async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/clients/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.updateClient(req.params.id, clientData);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/clients/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const success = await storage.deleteClient(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Account Head routes
  app.get("/api/account-heads", requireAuth, async (req, res) => {
    try {
      const accountHeads = await storage.getAccountHeads();
      res.json(accountHeads);
    } catch (error) {
      console.error("Error fetching account heads:", error);
      res.status(500).json({ message: "Failed to fetch account heads", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/account-heads", requireAuth, writeLimiter, async (req, res) => {
    try {
      const accountHeadData = insertAccountHeadSchema.parse(req.body);
      const accountHead = await storage.createAccountHead(accountHeadData);
      res.json(accountHead);
    } catch (error) {
      res.status(400).json({ message: "Invalid account head data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Sale routes
  app.get("/api/sales", requireAuth, cacheMiddleware(2 * 60 * 1000), async (req, res) => {
    try {
      const { status, page = '1', limit = '50' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
      
      const sales = status 
        ? await storage.getSalesByStatus(status as string)
        : await storage.getSales();
      
      // Simple pagination
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedSales = sales.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedSales,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: sales.length,
          totalPages: Math.ceil(sales.length / limitNum)
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/sales", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        saleDate: new Date(req.body.saleDate),
      };
      const validatedData = apiInsertSaleSchema.parse(requestData);
      const saleDataForStorage: InsertSale = {
        ...validatedData,
        quantityGallons: validatedData.quantityGallons.toString(),
        salePricePerGallon: validatedData.salePricePerGallon.toString(),
        purchasePricePerGallon: validatedData.purchasePricePerGallon.toString(),
      };
      const sale = await storage.createSale(saleDataForStorage);
      res.json(sale);
    } catch (error) {
      console.error("Sale validation error:", error);
      res.status(400).json({ message: "Invalid sale data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/sales/:id/status", requireAuth, writeLimiter, async (req, res) => {
    try {
      const { status } = req.body;
      const sale = await storage.updateSaleStatus(req.params.id, status);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Failed to update sale status", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/sales/by-client/:clientId", requireAuth, async (req, res) => {
    try {
      const sales = await storage.getSalesByClient(req.params.clientId);
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales by client", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/sales/:id", requireAuth, async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sale", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/sales/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        saleDate: new Date(req.body.saleDate),
        ...(req.body.lpoDueDate && { lpoDueDate: new Date(req.body.lpoDueDate) }),
      };
      const validatedData = apiInsertSaleSchema.parse(requestData);
      const saleDataForStorage: InsertSale = {
        ...validatedData,
        quantityGallons: validatedData.quantityGallons.toString(),
        salePricePerGallon: validatedData.salePricePerGallon.toString(),
        purchasePricePerGallon: validatedData.purchasePricePerGallon.toString(),
      };
      const sale = await storage.updateSale(req.params.id, saleDataForStorage);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      console.error("Sale update validation error:", error);
      res.status(400).json({ message: "Invalid sale data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/sales/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const success = await storage.deleteSale(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json({ message: "Sale deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete sale", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Payment routes
  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/payments", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        paymentDate: new Date(req.body.paymentDate),
      };
      const paymentData = apiInsertPaymentSchema.parse(requestData);
      const payment = await storage.createPayment({
        ...paymentData,
        amountReceived: paymentData.amountReceived.toString(),
      });

      // After successful payment, check if the sale is fully paid
      const sale = await storage.getSale(paymentData.saleId);
      if (sale) {
        const payments = await storage.getPaymentsBySale(paymentData.saleId);
        const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amountReceived), 0);
        if (totalPaid >= parseFloat(sale.totalAmount)) {
          await storage.updateSaleStatus(paymentData.saleId, "Paid");
        }
      }

      res.json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/payments/sale/:saleId", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getPaymentsBySale(req.params.saleId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments for sale", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/payments/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const success = await storage.deletePayment(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete payment", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/payments/migrate-to-cashbook", requireAuth, writeLimiter, async (req, res) => {
    try {
      const migratedCount = await storage.migratePaymentsToCashbook();
      res.json({ 
        message: `Successfully migrated ${migratedCount} payments to cashbook`,
        migratedCount 
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to migrate payments to cashbook", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Invoice routes
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/invoices", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        invoiceDate: new Date(req.body.invoiceDate),
      };
      const invoiceData = insertInvoiceSchema.parse(requestData);
      const invoice = await storage.createInvoice(invoiceData);

      // Update sale status to "Invoiced"
      await storage.updateSaleStatus(invoiceData.saleId, "Invoiced");

      res.json(invoice);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Invoice validation error:", error);
      }
      res.status(400).json({ message: "Invalid invoice data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // New route: create invoice by LPO number for multiple sales
  app.post("/api/invoices/by-lpo", requireAuth, writeLimiter, async (req, res) => {
    try {
      const { lpoNumber, invoiceNumber, invoiceDate } = req.body || {};
      if (!lpoNumber || !invoiceNumber || !invoiceDate) {
        return res.status(400).json({ message: "lpoNumber, invoiceNumber and invoiceDate are required" });
      }
      const invoice = await storage.createInvoiceForLPO({
        lpoNumber,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
      });
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Failed to create invoice by LPO", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/invoices/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        invoiceDate: new Date(req.body.invoiceDate),
      };
      const invoiceData = insertInvoiceSchema.parse(requestData);
      const invoice = await storage.updateInvoice(req.params.id, invoiceData);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Invoice update error:", error);
      }
      res.status(400).json({ message: "Invalid invoice data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/invoices/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice", error: error instanceof Error ? error.message : String(error) });
    }
  });



  // Reports routes
  app.get("/api/notifications/overdue-clients", requireAuth, async (req, res) => {
    try {
      const days = Math.max(1, parseInt((req.query.days as string) || '30'));
      const result = await storage.getOverdueClientPayments(days);
      res.json({ days, data: result });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch overdue clients", error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.get("/api/reports/overview", requireAuth, async (req, res) => {
    try {
      const [
        totalRevenue, 
        totalCOGS, 
        grossProfit, 
        currentStock,
        pendingLPOCount,
        pendingLPOValue
      ] = await Promise.all([
        storage.getTotalRevenue(),
        storage.getTotalCOGS(),
        storage.getGrossProfit(),
        storage.getCurrentStockLevel(),
        storage.getPendingLPOCount(),
        storage.getPendingLPOValue()
      ]);

      res.json({
        totalRevenue, // excludes VAT
        totalCOGS,
        grossProfit, // equals subtotal - COGS across sales
        currentStock,
        pendingLPOCount,
        pendingLPOValue, // excludes VAT
        grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch report data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/reports/pending-business", requireAuth, async (req, res) => {
    try {
      const { clientId, dateFrom, dateTo } = req.query;
      const pendingBusiness = await storage.getPendingBusinessReport(
        clientId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json(pendingBusiness);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending business report", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/reports/vat", requireAuth, async (req, res) => {
    try {
      const { clientId, dateFrom, dateTo } = req.query;
      const vatReport = await storage.getVATReport(
        clientId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json(vatReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch VAT report", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Project routes
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/projects/by-client/:clientId", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjectsByClient(req.params.clientId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects by client", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.updateProject(req.params.id, projectData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Cashbook routes
  app.get("/api/cashbook", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getCashbookEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cashbook entries", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Supplier advance allocation listing
  app.get("/api/cashbook/supplier-advances", requireAuth, async (req, res) => {
    try {
      const advances = await storage.getSupplierAdvances();
      res.json(advances);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch supplier advances", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/cashbook/supplier-advance-allocations", requireAuth, writeLimiter, async (req, res) => {
    try {
      const allocationData = insertSupplierAdvanceAllocationSchema.parse(req.body);
      const allocation = await storage.createSupplierAdvanceAllocation(allocationData);
      res.json(allocation);
    } catch (error) {
      res.status(400).json({ message: "Invalid supplier advance allocation data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/balance", requireAuth, async (req, res) => {
    try {
      const balance = await storage.getCashBalance();
      res.json({ balance });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cash balance", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/summary", requireAuth, async (req, res) => {
    try {
      const summary = await storage.getTransactionSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction summary", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/pending-debts", requireAuth, async (req, res) => {
    try {
      const debts = await storage.getPendingDebts();
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending debts", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/cashbook/pay-debt/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const { paidAmount, paymentMethod } = req.body;
      const paymentDate = new Date(req.body.paymentDate || new Date());
      const paymentEntry = await storage.markDebtAsPaid(
        req.params.id, 
        parseFloat(paidAmount), 
        paymentMethod, 
        paymentDate
      );
      res.json(paymentEntry);
    } catch (error) {
      res.status(400).json({ message: "Failed to process debt payment", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/cashbook", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        transactionDate: new Date(req.body.transactionDate)
      };
      const cashbookData = insertCashbookSchema.parse(requestData);
      const entry = await storage.createCashbookEntry(cashbookData);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ message: "Invalid cashbook data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/cashbook/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        transactionDate: new Date(req.body.transactionDate)
      };
      const cashbookData = insertCashbookSchema.parse(requestData);
      const entry = await storage.updateCashbookEntry(req.params.id, cashbookData);
      if (!entry) {
        return res.status(404).json({ message: "Cashbook entry not found" });
      }
      res.json(entry);
    } catch (error) {
      res.status(400).json({ message: "Invalid cashbook data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/cashbook/:id", requireAuth, writeLimiter, async (req, res) => {
    try {
      const success = await storage.deleteCashbookEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cashbook entry not found" });
      }
      res.json({ message: "Cashbook entry deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete cashbook entry", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Cashbook Payment Allocation routes
  app.get("/api/cashbook/payment-allocations", requireAuth, async (req, res) => {
    try {
      const allocations = await storage.getCashbookPaymentAllocations();
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment allocations", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/cashbook/payment-allocations", requireAuth, writeLimiter, async (req, res) => {
    try {
      const allocationData = insertCashbookPaymentAllocationSchema.parse(req.body);
      const allocation = await storage.createCashbookPaymentAllocation(allocationData);
      res.json(allocation);
    } catch (error) {
      res.status(400).json({ message: "Invalid allocation data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/payment-allocations/:entryId", requireAuth, async (req, res) => {
    try {
      const allocations = await storage.getCashbookPaymentAllocationsByEntry(req.params.entryId);
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment allocations", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/pending-invoices", requireAuth, async (req, res) => {
    try {
      const accountHeadId = req.query.accountHeadId as string;
      const pendingInvoices = await storage.getPendingInvoicesForAllocation(accountHeadId);
      res.json(pendingInvoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending invoices", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Supplier Debt Tracking routes
  app.get("/api/cashbook/supplier-debts", requireAuth, async (req, res) => {
    try {
      const debts = await storage.getSupplierDebts();
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch supplier debts", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/supplier-debts/:supplierId/balance", requireAuth, async (req, res) => {
    try {
      const balance = await storage.getSupplierOutstandingBalance(req.params.supplierId);
      res.json({ balance });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch supplier balance", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/supplier-debts/:supplierId/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getSupplierPaymentHistory(req.params.supplierId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch supplier history", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Client Payment Tracking routes
  app.get("/api/cashbook/client-payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getClientPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client payments", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/client-payments/:clientId/balance", requireAuth, async (req, res) => {
    try {
      const balance = await storage.getClientOutstandingBalance(req.params.clientId);
      res.json({ balance });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client balance", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/client-payments/:clientId/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getClientPaymentHistory(req.params.clientId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client history", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Enhanced sales routes for delay tracking
  app.get("/api/sales/with-delays", requireAuth, async (req, res) => {
    try {
      const salesWithDelays = await storage.getSalesWithDelays();
      res.json(salesWithDelays);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales with delays", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Business Settings routes
  app.get("/api/business-settings", requireAuth, cacheMiddleware(10 * 60 * 1000), async (req, res) => {
    try {
      const settings = await storage.getBusinessSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch business settings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/business-settings", requireAuth, writeLimiter, async (req, res) => {
    // Clear cache when settings are updated
    clearCachePattern('/api/business-settings');
    try {
      const settingsData = insertBusinessSettingsSchema.parse(req.body);
      const settings = await storage.updateBusinessSettings(settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid business settings data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
