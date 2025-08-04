import { VercelRequest, VercelResponse } from '@vercel/node';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { sales, clients, invoices, payments, stock } from '../shared/schema.js';

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  const pathArray = Array.isArray(path) ? path : [path];
  const route = pathArray.join('/');

  try {
    // Sales routes
    if (route === 'sales' && req.method === 'GET') {
      const { startDate, endDate, clientId, minAmount, maxAmount, page = 1, limit = 10 } = req.query;
      
      let whereConditions: any[] = [];
      
      if (startDate && endDate) {
        whereConditions.push(and(gte(sales.saleDate, new Date(startDate as string)), lte(sales.saleDate, new Date(endDate as string))));
      }
      
      if (clientId) {
        whereConditions.push(eq(sales.clientId, clientId as string));
      }
      
      if (minAmount || maxAmount) {
        const amountConditions: any[] = [];
        if (minAmount) amountConditions.push(sql`${sales.totalAmount} >= ${minAmount}`);
        if (maxAmount) amountConditions.push(sql`${sales.totalAmount} <= ${maxAmount}`);
        if (amountConditions.length > 0) {
          whereConditions.push(and(...amountConditions));
        }
      }
      
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [salesData, totalCount] = await Promise.all([
        db.select()
          .from(sales)
          .leftJoin(clients, eq(sales.clientId, clients.id))
          .where(whereClause)
          .orderBy(desc(sales.saleDate))
          .limit(parseInt(limit as string))
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(sales)
          .where(whereClause)
          .then(result => result[0]?.count || 0)
      ]);
      
      return res.json({
        sales: salesData,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit as string))
        }
      });
    }

    if (route === 'sales' && req.method === 'POST') {
      const saleData = z.object({
        clientId: z.string(),
        projectId: z.string(),
        saleDate: z.string().transform(str => new Date(str)),
        quantityGallons: z.number().positive(),
        salePricePerGallon: z.number().positive(),
        purchasePricePerGallon: z.number().positive(),
        lpoNumber: z.string().optional(),
        lpoReceivedDate: z.string().transform(str => new Date(str)).optional(),
        lpoDueDate: z.string().transform(str => new Date(str)).optional(),
        invoiceDate: z.string().transform(str => new Date(str)).optional(),
        saleStatus: z.enum(['Pending LPO', 'LPO Received', 'Invoiced', 'Paid']),
        vatPercentage: z.number().positive(),
        subtotal: z.number().positive(),
        vatAmount: z.number().positive(),
        totalAmount: z.number().positive(),
        cogs: z.number().positive(),
        grossProfit: z.number().positive()
      }).parse(req.body);
      
      // Convert numbers to strings for decimal columns
      const insertData = {
        ...saleData,
        quantityGallons: saleData.quantityGallons.toString(),
        salePricePerGallon: saleData.salePricePerGallon.toString(),
        purchasePricePerGallon: saleData.purchasePricePerGallon.toString(),
        vatPercentage: saleData.vatPercentage.toString(),
        subtotal: saleData.subtotal.toString(),
        vatAmount: saleData.vatAmount.toString(),
        totalAmount: saleData.totalAmount.toString(),
        cogs: saleData.cogs.toString(),
        grossProfit: saleData.grossProfit.toString()
      };
      
      const [newSale] = await db.insert(sales).values(insertData).returning();
      return res.status(201).json(newSale);
    }

    // Clients routes
    if (route === 'clients' && req.method === 'GET') {
      const { page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [clientsData, totalCount] = await Promise.all([
        db.select().from(clients)
          .orderBy(asc(clients.name))
          .limit(parseInt(limit as string))
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(clients)
          .then(result => result[0]?.count || 0)
      ]);
      
      return res.json({
        clients: clientsData,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit as string))
        }
      });
    }

    if (route === 'clients' && req.method === 'POST') {
      const clientData = z.object({
        name: z.string().min(1),
        contactPerson: z.string().min(1),
        phoneNumber: z.string().min(1),
        email: z.string().email(),
        address: z.string().min(1)
      }).parse(req.body);
      
      const [newClient] = await db.insert(clients).values(clientData).returning();
      return res.status(201).json(newClient);
    }

    // Stock routes
    if (route === 'stock' && req.method === 'GET') {
      const stockData = await db.select().from(stock).orderBy(desc(stock.purchaseDate));
      return res.json(stockData);
    }

    if (route === 'stock' && req.method === 'POST') {
      const stockData = z.object({
        purchaseDate: z.string().transform(str => new Date(str)),
        quantityGallons: z.number().positive(),
        purchasePricePerGallon: z.number().positive(),
        vatPercentage: z.number().positive(),
        vatAmount: z.number().positive(),
        totalCost: z.number().positive()
      }).parse(req.body);
      
      // Convert numbers to strings for decimal columns
      const insertData = {
        ...stockData,
        quantityGallons: stockData.quantityGallons.toString(),
        purchasePricePerGallon: stockData.purchasePricePerGallon.toString(),
        vatPercentage: stockData.vatPercentage.toString(),
        vatAmount: stockData.vatAmount.toString(),
        totalCost: stockData.totalCost.toString()
      };
      
      const [newStock] = await db.insert(stock).values(insertData).returning();
      return res.status(201).json(newStock);
    }

    // Dashboard stats
    if (route === 'dashboard' && req.method === 'GET') {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const [monthlySales, totalClients, totalStock, recentSales] = await Promise.all([
        db.select({ total: sql<number>`sum(total_amount)` })
          .from(sales)
          .where(and(gte(sales.saleDate, startOfMonth), lte(sales.saleDate, endOfMonth)))
          .then(result => result[0]?.total || 0),
        db.select({ count: sql<number>`count(*)` })
          .from(clients)
          .then(result => result[0]?.count || 0),
        db.select({ total: sql<number>`sum(quantity_gallons)` })
          .from(stock)
          .then(result => result[0]?.total || 0),
        db.select()
          .from(sales)
          .leftJoin(clients, eq(sales.clientId, clients.id))
          .orderBy(desc(sales.saleDate))
          .limit(5)
      ]);
      
      return res.json({
        monthlySales,
        totalClients,
        totalStock,
        recentSales
      });
    }

    // Health check
    if (route === 'health' && req.method === 'GET') {
      return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // If no route matches
    return res.status(404).json({ error: 'Route not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 