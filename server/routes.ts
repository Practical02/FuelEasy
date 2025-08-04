import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertStockSchema, 
  insertClientSchema, 
  insertSaleSchema, 
  type InsertSale,
  insertPaymentSchema,
  insertInvoiceSchema,
  insertProjectSchema,
  insertCashbookSchema
} from "@shared/schema";

const apiInsertSaleSchema = insertSaleSchema.extend({
  quantityGallons: z.number(),
  salePricePerGallon: z.number(),
  purchasePricePerGallon: z.number(),
});

const apiInsertPaymentSchema = insertPaymentSchema.extend({
  amountReceived: z.number(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Stock routes
  app.get("/api/stock", async (req, res) => {
    try {
      const stock = await storage.getStock();
      res.json(stock);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to fetch current stock level", error: error instanceof Error ? error.message : String(error) });
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
      res.status(400).json({ message: "Invalid stock data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to delete stock entry", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to fetch client", error: error instanceof Error ? error.message : String(error) });
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
      res.status(400).json({ message: "Invalid client data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to delete client", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to fetch sales", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/sales", async (req, res) => {
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

  app.patch("/api/sales/:id/status", async (req, res) => {
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

  app.get("/api/sales/by-client/:clientId", async (req, res) => {
    try {
      const sales = await storage.getSalesByClient(req.params.clientId);
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales by client", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to fetch sale", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/sales/:id", async (req, res) => {
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

  app.delete("/api/sales/:id", async (req, res) => {
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
  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/payments", async (req, res) => {
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

  app.get("/api/payments/sale/:saleId", async (req, res) => {
    try {
      const payments = await storage.getPaymentsBySale(req.params.saleId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments for sale", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to delete payment", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Invoice routes
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/invoices", async (req, res) => {
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
      console.error("Invoice validation error:", error);
      res.status(400).json({ message: "Invalid invoice data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to fetch invoice", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
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
      console.error("Invoice update error:", error);
      res.status(400).json({ message: "Invalid invoice data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to delete invoice", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/invoices/:id/regenerate", async (req, res) => {
    try {
      const newInvoice = await storage.regenerateInvoice(req.params.id);
      if (!newInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(newInvoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to regenerate invoice", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to fetch report data", error: error instanceof Error ? error.message : String(error) });
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
    } catch (error).json({ message: "Failed to fetch pending business report", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to fetch VAT report", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Project routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/projects/by-client/:clientId", async (req, res) => {
    try {
      const projects = await storage.getProjectsByClient(req.params.clientId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects by client", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(400).json({ message: "Invalid project data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to delete project", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Cashbook routes
  app.get("/api/cashbook", async (req, res) => {
    try {
      const entries = await storage.getCashbookEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cashbook entries", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/balance", async (req, res) => {
    try {
      const balance = await storage.getCashBalance();
      res.json({ balance });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cash balance", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/summary", async (req, res) => {
    try {
      const summary = await storage.getTransactionSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction summary", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cashbook/pending-debts", async (req, res) => {
    try {
      const debts = await storage.getPendingDebts();
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending debts", error: error instanceof Error ? error.message : String(error) });
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
      res.status(400).json({ message: "Failed to process debt payment", error: error instanceof Error ? error.message : String(error) });
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
      res.status(400).json({ message: "Invalid cashbook data", error: error instanceof Error ? error.message : String(error) });
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
      res.status(500).json({ message: "Failed to delete cashbook entry", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Enhanced sales routes for delay tracking
  app.get("/api/sales/with-delays", async (req, res) => {
    try {
      const salesWithDelays = await storage.getSalesWithDelays();
      res.json(salesWithDelays);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales with delays", error: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
