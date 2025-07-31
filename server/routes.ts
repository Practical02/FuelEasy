import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertStockSchema, 
  insertClientSchema, 
  insertSaleSchema, 
  insertPaymentSchema,
  insertInvoiceSchema,
  insertProjectSchema,
  insertCashbookSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Stock routes
  app.get("/api/stock", async (req, res) => {
    try {
      const stock = await storage.getStock();
      res.json(stock);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock" });
    }
  });

  app.post("/api/stock", async (req, res) => {
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

  app.get("/api/stock/current-level", async (req, res) => {
    try {
      const level = await storage.getCurrentStockLevel();
      res.json({ currentLevel: level });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current stock level" });
    }
  });

  app.put("/api/stock/:id", async (req, res) => {
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
      res.status(400).json({ message: "Invalid stock data" });
    }
  });

  app.delete("/api/stock/:id", async (req, res) => {
    try {
      const success = await storage.deleteStock(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Stock entry not found" });
      }
      res.json({ message: "Stock entry deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete stock entry" });
    }
  });

  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.updateClient(req.params.id, clientData);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const success = await storage.deleteClient(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Sale routes
  app.get("/api/sales", async (req, res) => {
    try {
      const { status } = req.query;
      const sales = status 
        ? await storage.getSalesByStatus(status as string)
        : await storage.getSales();
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const saleData = insertSaleSchema.parse(req.body);
      const sale = await storage.createSale(saleData);
      res.json(sale);
    } catch (error) {
      res.status(400).json({ message: "Invalid sale data" });
    }
  });

  app.patch("/api/sales/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const sale = await storage.updateSaleStatus(req.params.id, status);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Failed to update sale status" });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

  app.patch("/api/sales/:id", async (req, res) => {
    try {
      const saleData = insertSaleSchema.parse(req.body);
      const sale = await storage.updateSale(req.params.id, saleData);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      res.status(400).json({ message: "Invalid sale data" });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const success = await storage.deleteSale(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json({ message: "Sale deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete sale" });
    }
  });

  // Payment routes
  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      res.json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment data" });
    }
  });

  app.get("/api/payments/sale/:saleId", async (req, res) => {
    try {
      const payments = await storage.getPaymentsBySale(req.params.saleId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments for sale" });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const success = await storage.deletePayment(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete payment" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Invalid invoice data" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Reports routes
  app.get("/api/reports/overview", async (req, res) => {
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
        totalRevenue,
        totalCOGS,
        grossProfit,
        currentStock,
        pendingLPOCount,
        pendingLPOValue,
        grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch report data" });
    }
  });

  app.get("/api/reports/pending-business", async (req, res) => {
    try {
      const { clientId, dateFrom, dateTo } = req.query;
      const pendingBusiness = await storage.getPendingBusinessReport(
        clientId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json(pendingBusiness);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending business report" });
    }
  });

  app.get("/api/reports/vat", async (req, res) => {
    try {
      const { clientId, dateFrom, dateTo } = req.query;
      const vatReport = await storage.getVATReport(
        clientId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json(vatReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch VAT report" });
    }
  });

  // Project routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/by-client/:clientId", async (req, res) => {
    try {
      const projects = await storage.getProjectsByClient(req.params.clientId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects by client" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.updateProject(req.params.id, projectData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Cashbook routes
  app.get("/api/cashbook", async (req, res) => {
    try {
      const entries = await storage.getCashbookEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cashbook entries" });
    }
  });

  app.get("/api/cashbook/balance", async (req, res) => {
    try {
      const balance = await storage.getCashBalance();
      res.json({ balance });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cash balance" });
    }
  });

  app.get("/api/cashbook/summary", async (req, res) => {
    try {
      const summary = await storage.getTransactionSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction summary" });
    }
  });

  app.get("/api/cashbook/pending-debts", async (req, res) => {
    try {
      const debts = await storage.getPendingDebts();
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending debts" });
    }
  });

  app.post("/api/cashbook/pay-debt/:id", async (req, res) => {
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
      res.status(400).json({ message: "Failed to process debt payment" });
    }
  });

  app.post("/api/cashbook", async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        transactionDate: new Date(req.body.transactionDate)
      };
      const cashbookData = insertCashbookSchema.parse(requestData);
      const entry = await storage.createCashbookEntry(cashbookData);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ message: "Invalid cashbook data" });
    }
  });

  app.delete("/api/cashbook/:id", async (req, res) => {
    try {
      const success = await storage.deleteCashbookEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cashbook entry not found" });
      }
      res.json({ message: "Cashbook entry deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete cashbook entry" });
    }
  });

  // Enhanced sales routes for delay tracking
  app.get("/api/sales/with-delays", async (req, res) => {
    try {
      const salesWithDelays = await storage.getSalesWithDelays();
      res.json(salesWithDelays);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales with delays" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
