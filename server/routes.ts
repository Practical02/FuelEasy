import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-simple";
import { 
  insertStockSchema, 
  insertClientSchema, 
  insertSaleSchema, 
  insertPaymentSchema 
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
      const stockData = insertStockSchema.parse(req.body);
      const stock = await storage.createStock(stockData);
      res.json(stock);
    } catch (error) {
      res.status(400).json({ message: "Invalid stock data" });
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

  const httpServer = createServer(app);
  return httpServer;
}
