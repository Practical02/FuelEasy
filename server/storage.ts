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
  type AccountHead,
  type InsertAccountHead,
  type CashbookEntryWithAccountHead,
  type CashbookPaymentAllocation,
  type InsertCashbookPaymentAllocation,
  type CashbookPaymentAllocationWithInvoice,
  type BusinessSettings,
  type InsertBusinessSettings,
  type InsertInvoiceSale,
  type InvoiceSale,
  users,
  stock,
  clients,
  projects,
  sales,
  invoices,
  payments,
  cashbook,
  accountHeads,
  cashbookPaymentAllocations,
  businessSettings,
  invoiceSales,
  supplierAdvanceAllocations,
  paymentProjects,
  SALE_COGS_DECIMAL_PLACES,
  SALE_PURCHASE_PPG_DECIMAL_PLACES,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, ne, desc, asc, sql, and, or, inArray, gte, lte, type SQL } from "drizzle-orm";

// Initialize database connection
const connectionString = process.env.DATABASE_URL || "";
const sql_conn = neon(connectionString);
const db = drizzle(sql_conn, { schema: { users, stock, clients, projects, sales, invoices, payments, cashbook, accountHeads, cashbookPaymentAllocations, businessSettings, invoiceSales, supplierAdvanceAllocations, paymentProjects } }); // supplierAdvanceAllocations legacy table

/** YYYY-MM-DD → start/end of local day for inclusive timestamp range queries. */
function startOfDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Round FIFO layer total once; derive stored ppg from cogs/qty (avoids qty × round(ppg) drift). */
function cogsAndPpgFromFifoRawTotal(rawTotalCost: number, qty: number): {
  cogs: number;
  pricePerGallon: number;
} {
  const cogsFactor = 10 ** SALE_COGS_DECIMAL_PLACES;
  const cogs = Math.round(rawTotalCost * cogsFactor) / cogsFactor;
  const ppgFactor = 10 ** SALE_PURCHASE_PPG_DECIMAL_PLACES;
  const pricePerGallon = qty > 0 ? Math.round((cogs / qty) * ppgFactor) / ppgFactor : 0;
  return { cogs, pricePerGallon };
}

/** Payment due = one calendar month after invoice/submission (matches legacy setMonth behavior). */
function addOneMonth(d: Date): Date {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + 1);
  return x;
}

/**
 * Open (unpaid) invoices: Generated = not yet submitted to client; Sent = submission date set.
 * Paid is only set when cashbook allocations cover the full amount (see updateInvoiceStatusIfPaid).
 */
function deriveOpenInvoiceStatus(submissionDate: Date | null | undefined): "Generated" | "Sent" {
  return submissionDate ? "Sent" : "Generated";
}

function effectiveDueDateForInvoice(inv: {
  dueDate: Date | null;
  submissionDate: Date | null;
  invoiceDate: Date | null;
}): Date | null {
  if (inv.dueDate) return new Date(inv.dueDate as Date);
  const base = inv.submissionDate ?? inv.invoiceDate;
  if (!base) return null;
  return addOneMonth(new Date(base as Date));
}

/** Filters for `/api/sales` list (SQL WHERE + LIMIT/OFFSET). */
export type SalesListFilters = {
  search?: string;
  statuses?: string[];
  clientIds?: string[];
  projectIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  minQty?: number;
  maxQty?: number;
};

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, passwordHash: string): Promise<boolean>;
  
  // Stock methods
  getStock(): Promise<Stock[]>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStock(id: string, stock: InsertStock): Promise<Stock | undefined>;
  deleteStock(id: string): Promise<boolean>;
  getCurrentStockLevel(): Promise<number>;
  /** FIFO: mix-and-match cost for next quantity gallons (oldest stock first). Returns null if insufficient stock. */
  getFIFOPurchaseCostForQuantity(
    quantityGallons: number,
    options?: { excludeSaleId?: string },
  ): Promise<{
    pricePerGallon: number;
    totalCost: number;
    breakdown?: Array<{ gallons: number; pricePerGallon: number; cost: number }>;
  } | null>;
  /** Stock list with remaining gallons per batch (FIFO consumption). */
  getStockWithBalance(): Promise<(Stock & { remainingGallons: number })[]>;
  
  // Client methods
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: InsertClient): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  // Account Head methods
  getAccountHeads(): Promise<AccountHead[]>;
  createAccountHead(accountHead: InsertAccountHead): Promise<AccountHead>;
  
  // Project methods
  getProjects(clientId?: string): Promise<ProjectWithClient[]>;
  getProjectsByClient(clientId: string): Promise<ProjectWithClient[]>;
  getProject(id: string): Promise<ProjectWithClient | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: InsertProject): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Sale methods
  getSales(): Promise<SaleWithClient[]>;
  /** Filtered list with optional SQL pagination (omit limit/offset to fetch all matches). */
  listSalesFiltered(
    filters: SalesListFilters,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: SaleWithClient[]; total: number }>;
  getSalesByClient(clientId: string): Promise<SaleWithClient[]>;
  getSalesByStatus(status: string): Promise<SaleWithClient[]>;
  getSale(id: string): Promise<SaleWithClient | undefined>;
  /** If another sale already has this delivery note (trimmed, case-insensitive), returns that sale's id. */
  findSaleIdByNormalizedDeliveryNote(
    deliveryNoteNumber: string,
    excludeSaleId?: string,
  ): Promise<string | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: string, sale: InsertSale): Promise<Sale | undefined>;
  updateSaleStatus(id: string, status: string): Promise<Sale | undefined>;
  bulkRecordLPO(params: { saleIds: string[]; lpoNumber: string; lpoReceivedDate?: Date }): Promise<{ updated: number; errors: string[] }>;
  deleteSale(id: string): Promise<boolean>;
  /** Replay FIFO and rewrite every sale's purchase cost fields (repair / after deletes). */
  reapplyFIFOCostsToAllSales(): Promise<void>;
  /** Diagnostics: stored COGS vs FIFO replay, inventory identity check, optional sale-date window. */
  getCostReconciliationSnapshot(opts?: {
    saleDateFrom?: string;
    saleDateTo?: string;
  }): Promise<{
    sumOriginalBatchPurchaseCost: number;
    sumEndingInventoryAtFifoCost: number;
    sumStoredCogsAllSales: number;
    sumQtyTimesStoredPurchasePpgAllSales: number;
    sumReplayedCogsDryRunAllSales: number;
    driftStoredCogsMinusReplayed: number;
    driftStoredCogsMinusQtyTimesPpg: number;
    inventoryIdentityResidual: number;
    saleWindow?: {
      from: string;
      to: string;
      sumStoredCogs: number;
      sumQtyTimesPurchasePpg: number;
      sumReplayedCogs: number;
      driftStoredMinusReplayed: number;
    };
  }>;

  // Invoice methods
  getInvoices(): Promise<any[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: InsertInvoice): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  createInvoiceForLPO(params: {
    lpoNumber: string;
    invoiceNumber: string;
    invoiceDate: Date;
    submissionDate?: Date | null;
  }): Promise<Invoice>;
  /** One cheque/payment covering multiple invoices (same client). Single cashbook inflow + allocations + sale payments. */
  bulkPayInvoices(params: {
    invoiceIds: string[];
    paymentDate: Date;
    paymentMethod: string;
    chequeNumber?: string | null;
  }): Promise<{ cashbookEntryId: string; totalAmount: string; paymentsCreated: number }>;
  
  // Payment methods
  getPayments(): Promise<PaymentWithSaleAndClient[]>;
  getPaymentsBySale(saleId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  deletePayment(id: string): Promise<boolean>;
  migratePaymentsToCashbook(): Promise<number>;
  
  // Cashbook methods
  getCashbookEntries(filters?: {
    accountHeadId?: string;
    dateFrom?: string;
    dateTo?: string;
    transactionType?: string;
    flow?: "inflow" | "outflow";
  }): Promise<CashbookEntryWithAccountHead[]>;
  getCashbookEntry(id: string): Promise<CashbookEntry | undefined>;
  createCashbookEntry(entry: InsertCashbook): Promise<CashbookEntry>;
  updateCashbookEntry(id: string, entry: InsertCashbook): Promise<CashbookEntry | undefined>;
  deleteCashbookEntry(id: string): Promise<boolean>;
  getCashBalance(): Promise<number>;
  getPendingDebts(): Promise<CashbookEntry[]>;
  getTransactionSummary(): Promise<{
    totalInflow: number;
    totalOutflow: number;
    pendingDebts: number;
    availableBalance: number;
  }>;
  markDebtAsPaid(cashbookId: string, paidAmount: number, paymentMethod: string, paymentDate: Date): Promise<CashbookEntry>;
  
  // Cashbook Payment Allocation methods
  getCashbookPaymentAllocations(): Promise<CashbookPaymentAllocationWithInvoice[]>;
  createCashbookPaymentAllocation(allocation: InsertCashbookPaymentAllocation): Promise<CashbookPaymentAllocation>;
  getCashbookPaymentAllocationsByEntry(cashbookEntryId: string): Promise<CashbookPaymentAllocationWithInvoice[]>;
  getPendingInvoicesForAllocation(accountHeadId?: string): Promise<any[]>;
  getInvoiceAllocatedAmount(invoiceId: string): Promise<number>;
  updateInvoiceStatusIfPaid(invoiceId: string): Promise<void>;

  // Supplier Debt Tracking methods
  getSupplierDebts(): Promise<CashbookEntryWithAccountHead[]>;
  getSupplierOutstandingBalance(supplierId: string): Promise<number>;
  getSupplierPaymentHistory(supplierId: string): Promise<CashbookEntry[]>;
  
  // Client Payment Tracking methods
  getClientPayments(): Promise<CashbookEntryWithAccountHead[]>;
  getClientOutstandingBalance(clientId: string): Promise<number>;
  getClientPaymentHistory(clientId: string): Promise<CashbookEntry[]>;
  getOverdueClientPayments(daysThreshold: number): Promise<{
    client: Client;
    invoices: Array<{
      id: string;
      invoiceNumber: string | null;
      invoiceDate: Date | null;
      submissionDate: Date | null;
      dueDate: Date | null;
      pendingAmount: number;
      totalAmount: number;
    }>;
    totalPending: number;
  }[]>;
  
  // Reporting methods
  getTotalRevenue(): Promise<number>;
  getSalesWithDelays(): Promise<any[]>;
  getTotalCOGS(): Promise<number>;
  getGrossProfit(): Promise<number>;
  getPendingLPOCount(): Promise<number>;
  getPendingLPOValue(): Promise<number>;
  /** Lifetime total gallons sold (all sales rows). */
  getTotalSoldQuantity(): Promise<number>;
  /** Lifetime stock purchases: sum of (total cost − VAT) across all batches. */
  getTotalPurchaseCostExVat(): Promise<number>;
  getPendingBusinessReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]>;
  getVATReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]>;
  
  // Business Settings methods
  getBusinessSettings(): Promise<BusinessSettings>;
  updateBusinessSettings(settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Database storage - no in-memory maps needed
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

  async updateUserPassword(userId: string, passwordHash: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ password: passwordHash })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return result.length > 0;
  }

  async getStock(): Promise<Stock[]> {
    return await db.select().from(stock).orderBy(desc(stock.purchaseDate), desc(stock.createdAt));
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

    const created = result[0];

    // Always record stock purchase as cashbook outflow (cost / expense) so cashbook tracks all costs
    const purchaseDate = (insertStock as any).purchaseDate || new Date();
    let stockPurchaseAccountHeadId: string;
    if ((insertStock as any).supplierAccountHeadId) {
      stockPurchaseAccountHeadId = (insertStock as any).supplierAccountHeadId as string;
    } else {
      const existing = await db.select().from(accountHeads).where(eq(accountHeads.name, "Stock Purchase")).limit(1);
      if (existing[0]) {
        stockPurchaseAccountHeadId = existing[0].id;
      } else {
        const [newHead] = await db.insert(accountHeads).values({ name: "Stock Purchase", type: "Expense" }).returning();
        stockPurchaseAccountHeadId = newHead.id;
      }
    }
    // Single cashbook line: stock purchase is always an outflow (negative to cash when settled).
    // With supplier: record full amount as pending payable on that supplier (settle via cashbook later).
    // Without supplier: immediate expense (Stock Purchase) so it hits outflow now.
    const supplierId = (insertStock as any).supplierAccountHeadId as string | undefined;
    if (supplierId) {
      await this.createCashbookEntry({
        transactionDate: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
        transactionType: "Stock Purchase",
        category: "Supplier payable",
        accountHeadId: supplierId,
        amount: totalCost.toFixed(2),
        isInflow: 0,
        description: `Stock purchase (payable) — ${quantity} gal @ ${pricePerGallon.toFixed(2)}/gal`,
        counterparty: "Supplier",
        paymentMethod: "Credit",
        referenceType: "stock",
        referenceId: created.id,
        isPending: 1,
        notes: `Stock ${created.id}. Settle pending when you pay the supplier.`,
      });
    } else {
      await this.createCashbookEntry({
        transactionDate: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
        transactionType: "Stock Purchase",
        category: "Cost",
        accountHeadId: stockPurchaseAccountHeadId,
        amount: totalCost.toFixed(2),
        isInflow: 0,
        description: `Stock purchase — ${quantity} gal @ ${pricePerGallon.toFixed(2)}/gal`,
        counterparty: "—",
        paymentMethod: "Cash",
        referenceType: "stock",
        referenceId: created.id,
        isPending: 0,
        notes: `Stock entry ${created.id}`,
      });
    }

    return created;
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

  /**
   * Compute FIFO purchase cost for a given quantity: mix-and-match from stock batches
   * (oldest purchase_date first). E.g. 100 gal @ 9 + 1500 gal @ 10, sale 150 gal
   * => first 100 @ 9, next 50 @ 10 => totalCost 900+500=1400, pricePerGallon 1400/150 ≈ 9.33.
   * Returns null if there is insufficient stock.
   */
  async getFIFOPurchaseCostForQuantity(
    quantityGallons: number,
    options?: { excludeSaleId?: string },
  ): Promise<{
    pricePerGallon: number;
    totalCost: number;
    breakdown?: Array<{ gallons: number; pricePerGallon: number; cost: number }>;
  } | null> {
    if (quantityGallons <= 0) return null;
    const batches = await db
      .select({ id: stock.id, quantityGallons: stock.quantityGallons, purchasePricePerGallon: stock.purchasePricePerGallon })
      .from(stock)
      .orderBy(asc(stock.purchaseDate), asc(stock.createdAt));
    const salesList = await db
      .select({ id: sales.id, quantityGallons: sales.quantityGallons })
      .from(sales)
      .orderBy(asc(sales.saleDate), asc(sales.id));

    const remaining = new Map<string, number>();
    for (const b of batches) {
      remaining.set(b.id, parseFloat(b.quantityGallons));
    }
    for (const s of salesList) {
      if (options?.excludeSaleId && s.id === options.excludeSaleId) continue;
      let q = parseFloat(s.quantityGallons);
      for (const b of batches) {
        if (q <= 0) break;
        const rem = remaining.get(b.id) ?? 0;
        const take = Math.min(rem, q);
        if (take > 0) {
          remaining.set(b.id, rem - take);
          q -= take;
        }
      }
    }
    let need = quantityGallons;
    let totalCost = 0;
    const breakdown: Array<{ gallons: number; pricePerGallon: number; cost: number }> = [];
    for (const b of batches) {
      if (need <= 0) break;
      const rem = remaining.get(b.id) ?? 0;
      const take = Math.min(rem, need);
      if (take > 0) {
        const price = parseFloat(b.purchasePricePerGallon);
        const cost = take * price;
        totalCost += cost;
        need -= take;
        breakdown.push({ gallons: take, pricePerGallon: price, cost });
      }
    }
    if (need > 0) return null;
    const { cogs, pricePerGallon } = cogsAndPpgFromFifoRawTotal(totalCost, quantityGallons);
    return {
      pricePerGallon,
      totalCost: cogs,
      breakdown,
    };
  }

  /** Return all stock entries with remaining gallons per batch (FIFO). */
  async getStockWithBalance(): Promise<(Stock & { remainingGallons: number })[]> {
    const batches = await db.select().from(stock).orderBy(asc(stock.purchaseDate), asc(stock.createdAt));
    const salesList = await db
      .select({ quantityGallons: sales.quantityGallons })
      .from(sales)
      .orderBy(asc(sales.saleDate), asc(sales.id));
    const remaining = new Map<string, number>();
    for (const b of batches) {
      remaining.set(b.id, parseFloat(b.quantityGallons));
    }
    for (const s of salesList) {
      let q = parseFloat(s.quantityGallons);
      for (const b of batches) {
        if (q <= 0) break;
        const rem = remaining.get(b.id) ?? 0;
        const take = Math.min(rem, q);
        if (take > 0) {
          remaining.set(b.id, rem - take);
          q -= take;
        }
      }
    }
    const withBalance = batches.map((b) => ({
      ...b,
      remainingGallons: remaining.get(b.id) ?? 0,
    }));
    // Newest purchases first in UI (FIFO above still used oldest-first for remaining gallons)
    return withBalance.sort(
      (a, b) =>
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime() ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Dry-run FIFO replay: same layer consumption and rounding as createSale / reapply.
   * Map omits sales with non-positive quantity.
   */
  private async computeReplayedFifoCostsForAllSales(): Promise<
    Map<string, { cogs: number; pricePerGallon: number }>
  > {
    const batches = await db
      .select({
        id: stock.id,
        quantityGallons: stock.quantityGallons,
        purchasePricePerGallon: stock.purchasePricePerGallon,
      })
      .from(stock)
      .orderBy(asc(stock.purchaseDate), asc(stock.createdAt));

    const salesList = await db
      .select()
      .from(sales)
      .orderBy(asc(sales.saleDate), asc(sales.id));

    const remaining = new Map<string, number>();
    for (const b of batches) {
      remaining.set(b.id, parseFloat(b.quantityGallons));
    }

    const replayById = new Map<string, { cogs: number; pricePerGallon: number }>();

    for (const sale of salesList) {
      const qty = parseFloat(sale.quantityGallons);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      let need = qty;
      let totalCost = 0;
      for (const b of batches) {
        if (need <= 0) break;
        const rem = remaining.get(b.id) ?? 0;
        const take = Math.min(rem, need);
        if (take > 0) {
          const price = parseFloat(b.purchasePricePerGallon);
          totalCost += take * price;
          remaining.set(b.id, rem - take);
          need -= take;
        }
      }

      const { cogs, pricePerGallon } = cogsAndPpgFromFifoRawTotal(totalCost, qty);
      replayById.set(sale.id, { cogs, pricePerGallon });
    }

    return replayById;
  }

  /**
   * Replay FIFO in sale-date order: each sale consumes from batch layers, then we
   * rewrite purchasePricePerGallon, cogs, and grossProfit to match. Stock
   * "remaining" already recomputes from all sales, but those stored fields do not —
   * after deleting a sale (or stock batch), other rows would otherwise keep stale costs.
   */
  async reapplyFIFOCostsToAllSales(): Promise<void> {
    const replayById = await this.computeReplayedFifoCostsForAllSales();
    const salesList = await db
      .select()
      .from(sales)
      .orderBy(asc(sales.saleDate), asc(sales.id));

    for (const sale of salesList) {
      const rec = replayById.get(sale.id);
      if (!rec) continue;

      const subtotal = parseFloat(sale.subtotal);
      const grossProfit = subtotal - rec.cogs;

      await db
        .update(sales)
        .set({
          purchasePricePerGallon: rec.pricePerGallon.toFixed(SALE_PURCHASE_PPG_DECIMAL_PLACES),
          cogs: rec.cogs.toFixed(SALE_COGS_DECIMAL_PLACES),
          grossProfit: grossProfit.toFixed(SALE_COGS_DECIMAL_PLACES),
        })
        .where(eq(sales.id, sale.id));
    }
  }

  /**
   * Explain COGS vs inventory-value gaps: stored aggregates vs a full FIFO replay,
   * and the stock identity (purchases ≈ COGS + ending) when opening inventory was zero.
   */
  async getCostReconciliationSnapshot(opts?: {
    saleDateFrom?: string;
    saleDateTo?: string;
  }): Promise<{
    sumOriginalBatchPurchaseCost: number;
    sumEndingInventoryAtFifoCost: number;
    sumStoredCogsAllSales: number;
    sumQtyTimesStoredPurchasePpgAllSales: number;
    sumReplayedCogsDryRunAllSales: number;
    driftStoredCogsMinusReplayed: number;
    driftStoredCogsMinusQtyTimesPpg: number;
    /** batchPurchaseCost - storedCogs - endingInventory (≈0 if no opening stock, no deleted batches, stored COGS correct) */
    inventoryIdentityResidual: number;
    saleWindow?: {
      from: string;
      to: string;
      sumStoredCogs: number;
      sumQtyTimesPurchasePpg: number;
      sumReplayedCogs: number;
      driftStoredMinusReplayed: number;
    };
  }> {
    const [batchRow] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${stock.quantityGallons}::numeric * ${stock.purchasePricePerGallon}::numeric), 0)`,
      })
      .from(stock);

    const withBal = await this.getStockWithBalance();
    const sumEndingInventoryAtFifoCost = withBal.reduce(
      (s, b) => s + b.remainingGallons * parseFloat(b.purchasePricePerGallon),
      0,
    );

    const [saleAgg] = await db
      .select({
        stored: sql<string>`COALESCE(SUM(${sales.cogs}::numeric), 0)`,
        qtyPpg: sql<string>`COALESCE(SUM(${sales.quantityGallons}::numeric * ${sales.purchasePricePerGallon}::numeric), 0)`,
      })
      .from(sales);

    const replayById = await this.computeReplayedFifoCostsForAllSales();
    let sumReplayedCogsDryRunAllSales = 0;
    for (const { cogs } of Array.from(replayById.values())) {
      sumReplayedCogsDryRunAllSales += cogs;
    }

    const sumOriginalBatchPurchaseCost = parseFloat(batchRow?.total ?? "0");
    const sumStoredCogsAllSales = parseFloat(saleAgg?.stored ?? "0");
    const sumQtyTimesStoredPurchasePpgAllSales = parseFloat(saleAgg?.qtyPpg ?? "0");

    const driftStoredCogsMinusReplayed = sumStoredCogsAllSales - sumReplayedCogsDryRunAllSales;
    const driftStoredCogsMinusQtyTimesPpg =
      sumStoredCogsAllSales - sumQtyTimesStoredPurchasePpgAllSales;
    const inventoryIdentityResidual =
      sumOriginalBatchPurchaseCost - sumStoredCogsAllSales - sumEndingInventoryAtFifoCost;

    const round4 = (n: number) => Math.round(n * 10000) / 10000;

    let saleWindow: {
      from: string;
      to: string;
      sumStoredCogs: number;
      sumQtyTimesPurchasePpg: number;
      sumReplayedCogs: number;
      driftStoredMinusReplayed: number;
    } | undefined;

    if (opts?.saleDateFrom && opts?.saleDateTo) {
      const fromMs = startOfDayFromYmd(opts.saleDateFrom).getTime();
      const toMs = endOfDayFromYmd(opts.saleDateTo).getTime();
      const salesRows = await db
        .select({
          id: sales.id,
          saleDate: sales.saleDate,
          cogs: sales.cogs,
          quantityGallons: sales.quantityGallons,
          purchasePricePerGallon: sales.purchasePricePerGallon,
        })
        .from(sales);

      let sumStoredCogs = 0;
      let sumQtyTimesPurchasePpg = 0;
      let sumReplayedCogs = 0;

      for (const row of salesRows) {
        const t = new Date(row.saleDate as Date).getTime();
        if (t < fromMs || t > toMs) continue;
        sumStoredCogs += parseFloat(row.cogs);
        sumQtyTimesPurchasePpg +=
          parseFloat(row.quantityGallons) * parseFloat(row.purchasePricePerGallon);
        const replay = replayById.get(row.id);
        if (replay) sumReplayedCogs += replay.cogs;
      }

      saleWindow = {
        from: opts.saleDateFrom,
        to: opts.saleDateTo,
        sumStoredCogs: round4(sumStoredCogs),
        sumQtyTimesPurchasePpg: round4(sumQtyTimesPurchasePpg),
        sumReplayedCogs: round4(sumReplayedCogs),
        driftStoredMinusReplayed: round4(sumStoredCogs - sumReplayedCogs),
      };
    }

    return {
      sumOriginalBatchPurchaseCost: round4(sumOriginalBatchPurchaseCost),
      sumEndingInventoryAtFifoCost: round4(sumEndingInventoryAtFifoCost),
      sumStoredCogsAllSales: round4(sumStoredCogsAllSales),
      sumQtyTimesStoredPurchasePpgAllSales: round4(sumQtyTimesStoredPurchasePpgAllSales),
      sumReplayedCogsDryRunAllSales: round4(sumReplayedCogsDryRunAllSales),
      driftStoredCogsMinusReplayed: round4(driftStoredCogsMinusReplayed),
      driftStoredCogsMinusQtyTimesPpg: round4(driftStoredCogsMinusQtyTimesPpg),
      inventoryIdentityResidual: round4(inventoryIdentityResidual),
      ...(saleWindow ? { saleWindow } : {}),
    };
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
    const newClient = result[0];

    // Create an account head for the new client
    await this.createAccountHead({
      name: newClient.name,
      type: "Client",
    });

    return newClient;
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
    try {
      // Get the client first to understand what we're deleting
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1);

      if (client.length === 0) {
        return false;
      }

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Get all sales for this client
      const clientSales = await db
        .select()
        .from(sales)
        .where(eq(sales.clientId, id));

      // 2. For each sale, delete related data
      for (const sale of clientSales) {
        // Delete cashbook payment allocations for invoices of this sale
        const saleInvoices = await db
          .select()
          .from(invoices)
          .where(eq(invoices.saleId, sale.id));

        for (const invoice of saleInvoices) {
          await db
            .delete(cashbookPaymentAllocations)
            .where(eq(cashbookPaymentAllocations.invoiceId, invoice.id));
        }

        // Delete cashbook entries related to payments for this sale
        const salePayments = await db
          .select()
          .from(payments)
          .where(eq(payments.saleId, sale.id));

        for (const payment of salePayments) {
          await db
            .delete(cashbook)
            .where(and(
              eq(cashbook.referenceType, "payment"),
              eq(cashbook.referenceId, payment.id)
            ));
        }

        // Delete payments for this sale
        await db
          .delete(payments)
          .where(eq(payments.saleId, sale.id));

        // Delete invoices for this sale
        await db
          .delete(invoices)
          .where(eq(invoices.saleId, sale.id));
      }

      // 3. Delete all sales for this client
      await db
        .delete(sales)
        .where(eq(sales.clientId, id));

      // 4. Delete all projects for this client
      await db
        .delete(projects)
        .where(eq(projects.clientId, id));

      // 5. Delete the account head for this client (if it exists)
      await db
        .delete(accountHeads)
        .where(eq(accountHeads.name, client[0].name));

      // 6. Delete the client itself
      const result = await db
        .delete(clients)
        .where(eq(clients.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting client:", error);
      throw error;
    }
  }

  async getAccountHeads(): Promise<AccountHead[]> {
    return await db.select().from(accountHeads).orderBy(accountHeads.name);
  }

  async createAccountHead(insertAccountHead: InsertAccountHead): Promise<AccountHead> {
    const result = await db.insert(accountHeads).values(insertAccountHead).returning();
    return result[0];
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
    const { data } = await this.listSalesFiltered({ clientIds: [clientId] }, {});
    return data;
  }

  async getSales(): Promise<SaleWithClient[]> {
    const { data } = await this.listSalesFiltered({}, {});
    return data;
  }

  async getSalesByStatus(status: string): Promise<SaleWithClient[]> {
    const { data } = await this.listSalesFiltered({ statuses: [status] }, {});
    return data;
  }

  async listSalesFiltered(
    filters: SalesListFilters,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: SaleWithClient[]; total: number }> {
    const salesSelect = {
      id: sales.id,
      clientId: sales.clientId,
      projectId: sales.projectId,
      saleDate: sales.saleDate,
      quantityGallons: sales.quantityGallons,
      salePricePerGallon: sales.salePricePerGallon,
      purchasePricePerGallon: sales.purchasePricePerGallon,
      lpoNumber: sales.lpoNumber,
      deliveryNoteNumber: sales.deliveryNoteNumber,
      lpoReceivedDate: sales.lpoReceivedDate,
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
      project: projects,
    } as const;

    const conditions: SQL[] = [];

    const search = filters.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          sql`COALESCE(${sales.lpoNumber}, '') ILIKE ${pattern}`,
          sql`COALESCE(${sales.deliveryNoteNumber}, '') ILIKE ${pattern}`,
          sql`${clients.name} ILIKE ${pattern}`,
          sql`${clients.contactPerson} ILIKE ${pattern}`,
          sql`COALESCE(${projects.name}, '') ILIKE ${pattern}`,
        )!,
      );
    }

    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(sales.saleStatus, filters.statuses));
    }

    if (filters.clientIds && filters.clientIds.length > 0) {
      conditions.push(inArray(sales.clientId, filters.clientIds));
    }

    if (filters.projectIds && filters.projectIds.length > 0) {
      conditions.push(inArray(sales.projectId, filters.projectIds));
    }

    if (filters.dateFrom) {
      conditions.push(gte(sales.saleDate, startOfDayFromYmd(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(sales.saleDate, endOfDayFromYmd(filters.dateTo)));
    }

    if (filters.minAmount != null && !Number.isNaN(filters.minAmount)) {
      conditions.push(sql`(${sales.totalAmount})::numeric >= ${filters.minAmount}`);
    }
    if (filters.maxAmount != null && !Number.isNaN(filters.maxAmount)) {
      conditions.push(sql`(${sales.totalAmount})::numeric <= ${filters.maxAmount}`);
    }
    if (filters.minQty != null && !Number.isNaN(filters.minQty)) {
      conditions.push(sql`(${sales.quantityGallons})::numeric >= ${filters.minQty}`);
    }
    if (filters.maxQty != null && !Number.isNaN(filters.maxQty)) {
      conditions.push(sql`(${sales.quantityGallons})::numeric <= ${filters.maxQty}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseFrom = db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id));

    const countRow = whereClause
      ? await baseFrom.where(whereClause)
      : await baseFrom;
    const total = countRow[0]?.count ?? 0;

    const limit = options?.limit;
    const offset = options?.offset ?? 0;

    let dataQuery = db
      .select(salesSelect)
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .orderBy(desc(sales.createdAt));

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause) as typeof dataQuery;
    }
    if (limit != null && limit > 0) {
      dataQuery = dataQuery.limit(limit).offset(offset) as typeof dataQuery;
    }

    const result = await dataQuery;
    const data = result.map((r) => ({
      ...r,
      client: r.client!,
      project: r.project,
    }));

    return { data, total };
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
        deliveryNoteNumber: sales.deliveryNoteNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
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

  async findSaleIdByNormalizedDeliveryNote(
    deliveryNoteNumber: string,
    excludeSaleId?: string,
  ): Promise<string | undefined> {
    const n = deliveryNoteNumber.trim().toLowerCase();
    if (!n) return undefined;
    const conditions: SQL[] = [
      sql`LOWER(TRIM(COALESCE(${sales.deliveryNoteNumber}, ''))) = ${n}`,
    ];
    if (excludeSaleId) {
      conditions.push(ne(sales.id, excludeSaleId));
    }
    const result = await db
      .select({ id: sales.id })
      .from(sales)
      .where(and(...conditions))
      .limit(1);
    return result[0]?.id;
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

    const fifo = await this.getFIFOPurchaseCostForQuantity(quantity);
    let cogs: number;
    let purchasePriceStored: number;
    if (fifo) {
      cogs = fifo.totalCost;
      purchasePriceStored = fifo.pricePerGallon;
    } else {
      const cf = 10 ** SALE_COGS_DECIMAL_PLACES;
      const pf = 10 ** SALE_PURCHASE_PPG_DECIMAL_PLACES;
      cogs = Math.round(quantity * purchasePrice * cf) / cf;
      purchasePriceStored = Math.round(purchasePrice * pf) / pf;
    }
    const grossProfit = subtotal - cogs; // Exclude VAT for GP
    
    const saleData = {
      ...insertSale,
      saleStatus: insertSale.saleStatus || "Pending LPO",
      vatPercentage: insertSale.vatPercentage || "5.00",
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      purchasePricePerGallon: purchasePriceStored.toFixed(SALE_PURCHASE_PPG_DECIMAL_PLACES),
      cogs: cogs.toFixed(SALE_COGS_DECIMAL_PLACES),
      grossProfit: grossProfit.toFixed(SALE_COGS_DECIMAL_PLACES)
    };
    
    const result = await db.insert(sales).values(saleData).returning();
    
    // Create cashbook entry for sale revenue when sale is completed/paid
    if (saleData.saleStatus === "Paid") {
      await this.createCashbookEntry({
        transactionDate: insertSale.saleDate,
        transactionType: "Sale Revenue",
        accountHeadId: insertSale.clientId,
        amount: totalAmount.toFixed(2),
        isInflow: 1,
        description: `Sale revenue - ${quantity} gallons`,
        counterparty: "Client",
        paymentMethod: "Cash",
        referenceType: "sale",
        referenceId: result[0].id,
        isPending: 0,
        notes: `Sale at ${salePrice}/gallon, Purchase at ${purchasePriceStored}/gallon`
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
    // Fetch invoices with primary sale join for backward-compat display
    const invRows = await db
      .select({ inv: invoices, s: sales, c: clients, p: projects })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .orderBy(desc(invoices.createdAt));

    const allInvoiceIds = invRows.map(r => r.inv.id);
    // Compute allocated amounts per invoice
    const allocations = allInvoiceIds.length
      ? await db
          .select({ invoiceId: cashbookPaymentAllocations.invoiceId, amountAllocated: sql<number>`COALESCE(SUM(${cashbookPaymentAllocations.amountAllocated})::numeric, 0)` })
          .from(cashbookPaymentAllocations)
          .where(inArray(cashbookPaymentAllocations.invoiceId, allInvoiceIds))
          .groupBy(cashbookPaymentAllocations.invoiceId)
      : [] as Array<{ invoiceId: string; amountAllocated: number }>;
    const allocatedMap: Record<string, number> = {};
    for (const a of allocations) allocatedMap[a.invoiceId] = a.amountAllocated;

    // Build list of all LPO numbers to fetch their sales
    const lpoSet = new Set(invRows.map(r => r.inv.lpoNumber).filter(Boolean) as string[]);
    const lpoList = Array.from(lpoSet);
    const salesByLpo: Record<string, any[]> = {};
    if (lpoList.length) {
      const lpoSales = await db
        .select({ s: sales, c: clients, p: projects })
        .from(sales)
        .leftJoin(clients, eq(sales.clientId, clients.id))
        .leftJoin(projects, eq(sales.projectId, projects.id))
        .where(inArray(sales.lpoNumber, lpoList));
      for (const row of lpoSales) {
        const lpo = row.s.lpoNumber || '';
        if (!salesByLpo[lpo]) salesByLpo[lpo] = [];
        salesByLpo[lpo].push({ ...row.s, client: row.c, project: row.p });
      }
    }

    return invRows.map(r => {
      const inv = r.inv;
      const allocated = allocatedMap[inv.id] || 0;
      const pendingAmount = parseFloat(inv.totalAmount) - allocated;
      const primarySale = r.s ? { ...r.s, client: r.c, project: r.p } : null;
      const linkedSales = inv.lpoNumber ? (salesByLpo[inv.lpoNumber] || []) : (primarySale ? [primarySale] : []);
      return { ...inv, sale: primarySale, sales: linkedSales, pendingAmount: pendingAmount.toFixed(2) };
    });
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const values = { ...insertInvoice } as Record<string, unknown>;
    if (insertInvoice.submissionDate) {
      values.dueDate = addOneMonth(new Date(insertInvoice.submissionDate as Date));
    } else if (insertInvoice.invoiceDate) {
      values.dueDate = addOneMonth(new Date(insertInvoice.invoiceDate as Date));
    }
    values.status = deriveOpenInvoiceStatus(insertInvoice.submissionDate ?? null);
    const result = await db.insert(invoices).values(values as any).returning();
    const inv = result[0];
    // Link the single sale in invoice_sales for consistency
    await db.insert(invoiceSales).values({ invoiceId: inv.id, saleId: insertInvoice.saleId });
    // Update sale status to "Invoiced"
    await this.updateSaleStatus(insertInvoice.saleId, "Invoiced");
    return inv;
  }

  async updateInvoice(id: string, insertInvoice: InsertInvoice): Promise<Invoice | undefined> {
    const existing = await this.getInvoice(id);
    if (!existing) return undefined;

    const submissionResolved =
      insertInvoice.submissionDate === undefined
        ? existing.submissionDate
        : insertInvoice.submissionDate;

    const updateData = {
      ...insertInvoice,
      submissionDate: submissionResolved,
    } as Record<string, unknown>;

    if (submissionResolved) {
      updateData.dueDate = addOneMonth(new Date(submissionResolved as Date));
    } else if (insertInvoice.invoiceDate) {
      updateData.dueDate = addOneMonth(new Date(insertInvoice.invoiceDate as Date));
    }

    updateData.status =
      existing.status === "Paid"
        ? "Paid"
        : deriveOpenInvoiceStatus(submissionResolved);

    const result = await db
      .update(invoices)
      .set(updateData as any)
      .where(eq(invoices.id, id))
      .returning();
    await this.updateInvoiceStatusIfPaid(id);
    return (await this.getInvoice(id)) ?? result[0];
  }

  async createInvoiceForLPO(params: {
    lpoNumber: string;
    invoiceNumber: string;
    invoiceDate: Date;
    submissionDate?: Date | null;
  }): Promise<Invoice> {
    const { lpoNumber, invoiceNumber, invoiceDate } = params;

    // Find all sales with this LPO that are not yet invoiced or paid
    const candidateSales = await db
      .select()
      .from(sales)
      .where(and(eq(sales.lpoNumber, lpoNumber), sql`${sales.saleStatus} IN ('LPO Received', 'Pending LPO')` as any));

    if (candidateSales.length === 0) {
      throw new Error(`No eligible sales found for LPO ${lpoNumber}`);
    }

    // Sum totals across sales
    const totalAmount = candidateSales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
    const vatAmount = candidateSales.reduce((sum, s) => sum + parseFloat(s.vatAmount), 0);

    const dueDate = params.submissionDate
      ? addOneMonth(new Date(params.submissionDate))
      : addOneMonth(new Date(invoiceDate));
    // Create invoice row (pick first sale's id for legacy column, but will link all via invoice_sales)
    const baseSaleId = candidateSales[0].id;
    const submissionDate = params.submissionDate ?? null;
    const invRows = await db.insert(invoices).values({
      saleId: baseSaleId,
      invoiceNumber,
      invoiceDate,
      submissionDate,
      dueDate,
      lpoNumber,
      totalAmount: totalAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      status: deriveOpenInvoiceStatus(submissionDate),
    }).returning();
    const invoice = invRows[0];

    // Link all sales to this invoice and mark status as Invoiced
    for (const s of candidateSales) {
      await db.insert(invoiceSales).values({ invoiceId: invoice.id, saleId: s.id });
      await this.updateSaleStatus(s.id, "Invoiced");
    }

    return invoice;
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

    const client = await this.getClient(sale.clientId);
    if (!client) {
      throw new Error("Client not found for this sale");
    }

    // Find or create account head for the client using database
    let clientAccountHead = await db
      .select()
      .from(accountHeads)
      .where(eq(accountHeads.name, client.name))
      .limit(1);

    if (clientAccountHead.length === 0) {
      const newAccountHead = await db.insert(accountHeads).values({
        name: client.name,
        type: "Client",
      }).returning();
      clientAccountHead = newAccountHead;
    }

    // Create cashbook entry for payment received
    const cashbookEntry = await this.createCashbookEntry({
      transactionDate: insertPayment.paymentDate,
      transactionType: "Invoice",
      category: "Payment Received",
      accountHeadId: clientAccountHead[0].id,
      amount: parseFloat(insertPayment.amountReceived).toFixed(2),
      isInflow: 1,
      description: `Payment received from ${client.name} for LPO ${sale.lpoNumber || "N/A"}`,
      counterparty: client.name,
      paymentMethod: insertPayment.paymentMethod,
      referenceType: "payment",
      referenceId: payment.id,
      isPending: 0,
      notes: `Amount: ${insertPayment.amountReceived}`
    });

    // Find the invoice for this sale and automatically allocate the payment
    // 1) Try via invoice_sales link (multi-sale invoices)
    let invoiceRow = null as Invoice | null;
    const link = await db.select().from(invoiceSales).where(eq(invoiceSales.saleId, insertPayment.saleId)).limit(1);
    if (link[0]) {
      const inv = await db.select().from(invoices).where(eq(invoices.id, link[0].invoiceId)).limit(1);
      if (inv[0]) invoiceRow = inv[0];
    }
    // 2) Fallback to legacy single-sale invoice
    if (!invoiceRow) {
      const inv = await db.select().from(invoices).where(eq(invoices.saleId, insertPayment.saleId)).limit(1);
      if (inv[0]) invoiceRow = inv[0];
    }

    if (invoiceRow) {
      // Automatically allocate the full payment amount to the invoice
      await this.createCashbookPaymentAllocation({
        cashbookEntryId: cashbookEntry.id,
        invoiceId: invoiceRow.id,
        amountAllocated: insertPayment.amountReceived,
      });
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
    
    // Auto-settle supplier pending debts using the received amount (FIFO, full-settlement only)
    try {
      let remainingToSettle = parseFloat(insertPayment.amountReceived);
      if (remainingToSettle > 0) {
        const supplierDebts = await db
          .select({
            id: cashbook.id,
            amount: cashbook.amount,
            transactionDate: cashbook.transactionDate,
            accountHead: accountHeads,
          })
          .from(cashbook)
          .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
          .where(and(eq(cashbook.isPending, 1), eq(accountHeads.type, "Supplier")))
          .orderBy(cashbook.transactionDate);

        for (const debt of supplierDebts) {
          if (remainingToSettle <= 0) break;
          const debtAmount = parseFloat(debt.amount);
          // Only settle if we can fully pay this debt
          if (remainingToSettle + 1e-6 >= debtAmount) {
            await this.markDebtAsPaid(
              debt.id,
              debtAmount,
              insertPayment.paymentMethod,
              insertPayment.paymentDate instanceof Date ? insertPayment.paymentDate : new Date(insertPayment.paymentDate as any)
            );
            remainingToSettle -= debtAmount;
          }
        }
      }
    } catch (e) {
      console.warn("Auto-settle supplier debts failed:", e);
    }

    return payment;
  }

  /** Sale IDs covered by an invoice (invoice_sales rows, or legacy invoices.saleId). */
  private async getSaleIdsForInvoice(invoiceId: string): Promise<string[]> {
    const links = await db
      .select({ saleId: invoiceSales.saleId })
      .from(invoiceSales)
      .where(eq(invoiceSales.invoiceId, invoiceId));
    if (links.length > 0) {
      return Array.from(new Set(links.map((l) => l.saleId)));
    }
    const inv = await this.getInvoice(invoiceId);
    return inv ? [inv.saleId] : [];
  }

  async bulkPayInvoices(params: {
    invoiceIds: string[];
    paymentDate: Date;
    paymentMethod: string;
    chequeNumber?: string | null;
  }): Promise<{ cashbookEntryId: string; totalAmount: string; paymentsCreated: number }> {
    const uniqueIds = Array.from(new Set(params.invoiceIds));
    if (uniqueIds.length === 0) {
      throw new Error("Select at least one invoice");
    }

    type Row = {
      id: string;
      inv: Invoice;
      pending: number;
      clientName: string;
      saleIds: string[];
      invoiceNumber: string;
    };
    const rows: Row[] = [];
    let commonClientId: string | null = null;

    for (const id of uniqueIds) {
      const inv = await this.getInvoice(id);
      if (!inv) {
        throw new Error(`Invoice not found: ${id}`);
      }
      const allocated = await this.getInvoiceAllocatedAmount(id);
      const pending = parseFloat(inv.totalAmount) - allocated;
      if (pending <= 0.009) {
        throw new Error(`Invoice ${inv.invoiceNumber} has no remaining balance to pay`);
      }

      const saleIds = await this.getSaleIdsForInvoice(id);
      if (saleIds.length === 0) {
        throw new Error(`Invoice ${inv.invoiceNumber} has no linked sales`);
      }
      const primarySale = await this.getSale(saleIds[0]);
      if (!primarySale) {
        throw new Error(`Cannot load sale for invoice ${inv.invoiceNumber}`);
      }
      const client = await this.getClient(primarySale.clientId);
      const clientName = client?.name ?? "Client";
      if (commonClientId === null) {
        commonClientId = primarySale.clientId;
      } else if (commonClientId !== primarySale.clientId) {
        throw new Error("All selected invoices must be for the same client (one cheque per client)");
      }

      rows.push({
        id,
        inv,
        pending,
        clientName,
        saleIds,
        invoiceNumber: inv.invoiceNumber,
      });
    }

    const total = rows.reduce((s, r) => s + r.pending, 0);

    let clientAccountHead = await db
      .select()
      .from(accountHeads)
      .where(eq(accountHeads.name, rows[0].clientName))
      .limit(1);
    if (clientAccountHead.length === 0) {
      const created = await db
        .insert(accountHeads)
        .values({ name: rows[0].clientName, type: "Client" })
        .returning();
      clientAccountHead = created;
    }

    const detailLines = rows.map((r) => `${r.invoiceNumber} (${r.pending.toFixed(2)})`).join("; ");
    const chequePart =
      params.chequeNumber?.trim() && params.paymentMethod === "Cheque"
        ? ` — Cheque #${params.chequeNumber.trim()}`
        : params.paymentMethod
          ? ` — ${params.paymentMethod}`
          : "";
    const description = `Payment received${chequePart} — ${detailLines}`.slice(0, 4000);
    const notes = `Bulk payment: ${rows.length} invoice(s), total ${total.toFixed(2)}.`.slice(0, 4000);

    const cashbookEntry = await this.createCashbookEntry({
      transactionDate: params.paymentDate,
      transactionType: "Invoice",
      category: "Payment Received",
      accountHeadId: clientAccountHead[0].id,
      amount: total.toFixed(2),
      isInflow: 1,
      description,
      counterparty: rows[0].clientName,
      paymentMethod: params.paymentMethod,
      referenceType: "bulk_invoice_payment",
      isPending: 0,
      notes,
    });

    for (const r of rows) {
      await this.createCashbookPaymentAllocation({
        cashbookEntryId: cashbookEntry.id,
        invoiceId: r.id,
        amountAllocated: r.pending.toFixed(2),
      });
    }

    const processedSaleIds = new Set<string>();
    let paymentsCreated = 0;
    for (const r of rows) {
      for (const saleId of r.saleIds) {
        if (processedSaleIds.has(saleId)) continue;
        processedSaleIds.add(saleId);
        const sale = await this.getSale(saleId);
        if (!sale) continue;
        const existing = await this.getPaymentsBySale(saleId);
        const paidSoFar = existing.reduce((s, p) => s + parseFloat(p.amountReceived), 0);
        const need = parseFloat(sale.totalAmount) - paidSoFar;
        if (need <= 0.009) continue;
        await db.insert(payments).values({
          saleId,
          paymentDate: params.paymentDate,
          amountReceived: need.toFixed(2),
          paymentMethod: params.paymentMethod,
          chequeNumber: params.chequeNumber?.trim() || null,
        });
        paymentsCreated += 1;
        const newPaid = paidSoFar + need;
        const saleTotal = parseFloat(sale.totalAmount);
        let newStatus = sale.saleStatus;
        if (newPaid >= saleTotal - 1e-6) {
          newStatus = "Paid";
        } else if (sale.saleStatus !== "Paid") {
          newStatus = "Invoiced";
        }
        if (newStatus !== sale.saleStatus) {
          await this.updateSaleStatus(saleId, newStatus);
        }
      }
    }

    try {
      let remainingToSettle = total;
      if (remainingToSettle > 0) {
        const supplierDebts = await db
          .select({
            id: cashbook.id,
            amount: cashbook.amount,
            transactionDate: cashbook.transactionDate,
            accountHead: accountHeads,
          })
          .from(cashbook)
          .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
          .where(and(eq(cashbook.isPending, 1), eq(accountHeads.type, "Supplier")))
          .orderBy(cashbook.transactionDate);

        for (const debt of supplierDebts) {
          if (remainingToSettle <= 0) break;
          const debtAmount = parseFloat(debt.amount);
          if (remainingToSettle + 1e-6 >= debtAmount) {
            await this.markDebtAsPaid(
              debt.id,
              debtAmount,
              params.paymentMethod,
              params.paymentDate instanceof Date ? params.paymentDate : new Date(params.paymentDate as unknown as string),
            );
            remainingToSettle -= debtAmount;
          }
        }
      }
    } catch (e) {
      console.warn("Auto-settle supplier debts failed (bulk invoice pay):", e);
    }

    return {
      cashbookEntryId: cashbookEntry.id,
      totalAmount: total.toFixed(2),
      paymentsCreated,
    };
  }

  // Cashbook methods
  async getCashbookEntries(filters?: {
    accountHeadId?: string;
    dateFrom?: string;
    dateTo?: string;
    transactionType?: string;
    flow?: "inflow" | "outflow";
  }): Promise<CashbookEntryWithAccountHead[]> {
    const conditions = [];
    if (filters?.accountHeadId) conditions.push(eq(cashbook.accountHeadId, filters.accountHeadId));
    if (filters?.dateFrom) conditions.push(gte(cashbook.transactionDate, new Date(filters.dateFrom)));
    if (filters?.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(cashbook.transactionDate, end));
    }
    if (filters?.transactionType) conditions.push(eq(cashbook.transactionType, filters.transactionType));
    if (filters?.flow === "inflow") conditions.push(eq(cashbook.isInflow, 1));
    if (filters?.flow === "outflow") conditions.push(eq(cashbook.isInflow, 0));

    const base = db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id));
    const result = await (conditions.length
      ? base.where(and(...conditions)).orderBy(desc(cashbook.transactionDate))
      : base.orderBy(desc(cashbook.transactionDate)));

    // Calculate allocation status for client payments
    const entriesWithStatus = await Promise.all(
      result.map(async (r) => {
        const entryWithAccountHead = {
          ...r,
          accountHead: r.accountHead!,
        };

        // Only calculate status for client payments (inflow transactions)
        if (r.isInflow === 1 && r.accountHead && r.accountHead.type === "Client") {
          const totalAllocated = await this.getCashbookEntryAllocatedAmount(r.id);
          const totalAmount = parseFloat(r.amount);
          
          let allocationStatus = "Not Allocated";
          if (totalAllocated > 0) {
            if (Math.abs(totalAllocated - totalAmount) < 0.01) {
              allocationStatus = "Fully Allocated";
            } else if (totalAllocated < totalAmount) {
              allocationStatus = "Partially Allocated";
            } else {
              allocationStatus = "Over-allocated";
            }
          }
          
          return {
            ...entryWithAccountHead,
            allocationStatus,
            allocatedAmount: totalAllocated,
          };
        }

        return entryWithAccountHead;
      })
    );

    return entriesWithStatus;
  }

  async getCashbookEntry(id: string): Promise<CashbookEntry | undefined> {
    const result = await db.select().from(cashbook).where(eq(cashbook.id, id));
    return result[0];
  }

  async createCashbookEntry(insertCashbook: InsertCashbook): Promise<CashbookEntry> {
    try {
      // Validate required fields
      if (!insertCashbook.transactionDate || !insertCashbook.transactionType || !insertCashbook.amount || !insertCashbook.accountHeadId) {
        throw new Error("Missing required fields: transactionDate, transactionType, amount, accountHeadId");
      }

      // Validate amount is positive
      const amount = parseFloat(insertCashbook.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Validate account head exists
      const accountHead = await db.select().from(accountHeads).where(eq(accountHeads.id, insertCashbook.accountHeadId)).limit(1);
      if (accountHead.length === 0) {
        throw new Error("Account head not found");
      }

      const result = await db.insert(cashbook).values(insertCashbook).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating cashbook entry:", error);
      throw error;
    }
  }

  async updateCashbookEntry(id: string, updateCashbook: InsertCashbook): Promise<CashbookEntry | undefined> {
    try {
      // Validate required fields
      if (!updateCashbook.transactionDate || !updateCashbook.transactionType || !updateCashbook.amount || !updateCashbook.accountHeadId) {
        throw new Error("Missing required fields: transactionDate, transactionType, amount, accountHeadId");
      }

      // Validate amount is positive
      const amount = parseFloat(updateCashbook.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Validate account head exists
      const accountHead = await db.select().from(accountHeads).where(eq(accountHeads.id, updateCashbook.accountHeadId)).limit(1);
      if (accountHead.length === 0) {
        throw new Error("Account head not found");
      }

      // Check if entry exists
      const existingEntry = await db.select().from(cashbook).where(eq(cashbook.id, id)).limit(1);
      if (existingEntry.length === 0) {
        return undefined;
      }

      const result = await db.update(cashbook).set(updateCashbook).where(eq(cashbook.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating cashbook entry:", error);
      throw error;
    }
  }

  async deleteCashbookEntry(id: string): Promise<boolean> {
    try {
      // Get the cashbook entry first to understand what we're deleting
      const entry = await db
        .select()
        .from(cashbook)
        .where(eq(cashbook.id, id))
        .limit(1);

      if (entry.length === 0) {
        return false;
      }

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Delete all cashbook payment allocations for this entry
      await db
        .delete(cashbookPaymentAllocations)
        .where(eq(cashbookPaymentAllocations.cashbookEntryId, id));

      // 2. If this is a payment-related cashbook entry, also delete the payment
      if (entry[0].referenceType === "payment" && entry[0].referenceId) {
        // Get the payment details before deleting
        const payment = await db
          .select()
          .from(payments)
          .where(eq(payments.id, entry[0].referenceId))
          .limit(1);

        if (payment.length > 0) {
          const sale = await db
            .select()
            .from(sales)
            .where(eq(sales.id, payment[0].saleId))
            .limit(1);

          // Delete the associated payment
          await db
            .delete(payments)
            .where(eq(payments.id, entry[0].referenceId));

          if (sale.length > 0) {
            // Check if there are any remaining payments for this sale
            const remainingPayments = await db
              .select()
              .from(payments)
              .where(eq(payments.saleId, payment[0].saleId));

            if (remainingPayments.length === 0) {
              // No payments left, revert sale status to "Invoiced" if it was "Paid"
              if (sale[0].saleStatus === "Paid") {
                await db
                  .update(sales)
                  .set({ saleStatus: "Invoiced" })
                  .where(eq(sales.id, payment[0].saleId));
              }
            } else {
              // Recalculate total paid and update status
              const totalPaid = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amountReceived), 0);
              const saleTotal = parseFloat(sale[0].totalAmount);
              
              let newStatus = sale[0].saleStatus;
              if (totalPaid >= saleTotal) {
                newStatus = "Paid";
              } else if (sale[0].saleStatus === "Paid") {
                newStatus = "Invoiced";
              }

              if (newStatus !== sale[0].saleStatus) {
                await db
                  .update(sales)
                  .set({ saleStatus: newStatus })
                  .where(eq(sales.id, payment[0].saleId));
              }
            }
          }
        }
      }

      // 3. Delete the cashbook entry itself
      const result = await db
        .delete(cashbook)
        .where(eq(cashbook.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting cashbook entry:", error);
      throw error;
    }
  }

  async getCashBalance(): Promise<number> {
    const [inflowResult, outflowResult] = await Promise.all([
      db.select({
        totalInflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 1), eq(cashbook.isPending, 0))),
      db.select({
        totalOutflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 0), eq(cashbook.isPending, 0)))
    ]);
    
    const totalInflow = inflowResult[0]?.totalInflow || 0;
    const totalOutflow = outflowResult[0]?.totalOutflow || 0;
    
    return totalInflow - totalOutflow;
  }

  async getPendingDebts(): Promise<CashbookEntry[]> {
    return await db
      .select()
      .from(cashbook)
      .where(eq(cashbook.isPending, 1))
      .orderBy(desc(cashbook.transactionDate));
  }

  async getTransactionSummary(): Promise<{
    totalInflow: number;
    totalOutflow: number;
    pendingDebts: number;
    availableBalance: number;
  }> {
    const [inflowResult, outflowResult, pendingResult] = await Promise.all([
      db.select({
        totalInflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 1), eq(cashbook.isPending, 0))),
      db.select({
        totalOutflow: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(and(eq(cashbook.isInflow, 0), eq(cashbook.isPending, 0))),
      db.select({
        pendingDebts: sql<number>`COALESCE(SUM(${cashbook.amount}::numeric), 0)`
      }).from(cashbook).where(eq(cashbook.isPending, 1))
    ]);
    
    const totalInflow = inflowResult[0]?.totalInflow || 0;
    const totalOutflow = outflowResult[0]?.totalOutflow || 0;
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
    try {
      // Validate inputs
      if (!cashbookId || !paymentMethod || !paymentDate) {
        throw new Error("Missing required fields: cashbookId, paymentMethod, paymentDate");
      }

      if (paidAmount <= 0) {
        throw new Error("Paid amount must be positive");
      }

      // Get the original debt entry to retrieve its accountHeadId
      const originalDebtEntry = await this.getCashbookEntry(cashbookId);
      if (!originalDebtEntry) {
        throw new Error("Original debt entry not found");
      }

      if (originalDebtEntry.isPending !== 1) {
        throw new Error("Entry is not a pending debt");
      }

      // Update the original debt entry to mark it as not pending
      await db
        .update(cashbook)
        .set({ isPending: 0 })
        .where(eq(cashbook.id, cashbookId));

      // Create a new payment entry
      const paymentEntry = await this.createCashbookEntry({
        transactionDate: paymentDate,
        transactionType: "Supplier Payment",
        category: "Debt Settlement",
        accountHeadId: originalDebtEntry.accountHeadId,
        amount: paidAmount.toFixed(2),
        isInflow: 0, // Outflow since we're paying
        description: `Debt payment for ${originalDebtEntry.counterparty}`,
        paymentMethod,
        referenceType: "debt_payment",
        referenceId: cashbookId,
        isPending: 0,
        counterparty: originalDebtEntry.counterparty,
        notes: `Payment for debt: ${originalDebtEntry.description}`,
      });

      return paymentEntry;
    } catch (error) {
      console.error("Error marking debt as paid:", error);
      throw error;
    }
  }

  async getSalesWithDelays(): Promise<any[]> {
    const result = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        projectId: sales.projectId,
        saleDate: sales.saleDate,
        lpoReceivedDate: sales.lpoReceivedDate,
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
      
      if (r.saleStatus === "LPO Received" && r.lpoReceivedDate) {
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
    // Revenue should exclude VAT
    const result = await db.select({ 
      total: sql<number>`COALESCE(SUM(${sales.subtotal}::numeric), 0)` 
    }).from(sales);
    return result[0]?.total || 0;
  }

  async getTotalCOGS(): Promise<number> {
    // Align with profit reports and per-sale gross profit (stored cogs at sale time)
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${sales.cogs}::numeric), 0)`
    }).from(sales);
    return result[0]?.total || 0;
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
    // Use subtotal (exclude VAT) for pending value
    const result = await db.select({ 
      total: sql<number>`COALESCE(SUM(${sales.subtotal}::numeric), 0)` 
    }).from(sales).where(
      sql`${sales.saleStatus} IN ('Pending LPO', 'LPO Received')`
    );
    return result[0]?.total || 0;
  }

  async getTotalSoldQuantity(): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${sales.quantityGallons}::numeric), 0)`,
    }).from(sales);
    return result[0]?.total || 0;
  }

  async getTotalPurchaseCostExVat(): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM((${stock.totalCost}::numeric - ${stock.vatAmount}::numeric)), 0)`,
    }).from(stock);
    return result[0]?.total || 0;
  }

  async updateSale(id: string, saleData: InsertSale): Promise<Sale | undefined> {
    // Calculate VAT and totals
    const quantity = parseFloat(saleData.quantityGallons);
    const pricePerGallon = parseFloat(saleData.salePricePerGallon);
    const purchasePricePerGallon = parseFloat(saleData.purchasePricePerGallon);
    const vatPercentage = parseFloat(saleData.vatPercentage || "5.00");
    
    const subtotal = quantity * pricePerGallon;
    const vatAmount = subtotal * (vatPercentage / 100);
    const totalAmount = subtotal + vatAmount;

    const fifo = await this.getFIFOPurchaseCostForQuantity(quantity, { excludeSaleId: id });
    let cogs: number;
    let purchasePriceStored: number;
    if (fifo) {
      cogs = fifo.totalCost;
      purchasePriceStored = fifo.pricePerGallon;
    } else {
      const cf = 10 ** SALE_COGS_DECIMAL_PLACES;
      const pf = 10 ** SALE_PURCHASE_PPG_DECIMAL_PLACES;
      cogs = Math.round(quantity * purchasePricePerGallon * cf) / cf;
      purchasePriceStored = Math.round(purchasePricePerGallon * pf) / pf;
    }
    const grossProfit = subtotal - cogs; // Exclude VAT for GP

    // Auto-set invoice date when status changes to "Invoiced"/"Paid"
    let invoiceDate = null;
    if (saleData.saleStatus === "Invoiced" || saleData.saleStatus === "Paid") {
      invoiceDate = new Date();
    }

    // Derive LPO status if LPO number is provided
    let derivedStatus = saleData.saleStatus;
    const hasLpo = !!(saleData.lpoNumber && saleData.lpoNumber.toString().trim().length > 0);
    if (derivedStatus === "Pending LPO" && hasLpo) {
      derivedStatus = "LPO Received";
    }

    // Derive LPO received date if moving to LPO Received and not provided
    let lpoReceivedDate: Date | null = (saleData as any).lpoReceivedDate || null;
    if (derivedStatus === "LPO Received" && !lpoReceivedDate) {
      lpoReceivedDate = new Date();
    }

    const updatedSaleData = {
      ...saleData,
      saleStatus: derivedStatus,
      invoiceDate,
      lpoReceivedDate,
      vatPercentage: vatPercentage.toFixed(2),
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      purchasePricePerGallon: purchasePriceStored.toFixed(SALE_PURCHASE_PPG_DECIMAL_PLACES),
      cogs: cogs.toFixed(SALE_COGS_DECIMAL_PLACES),
      grossProfit: grossProfit.toFixed(SALE_COGS_DECIMAL_PLACES),
    };

    const result = await db
      .update(sales)
      .set(updatedSaleData)
      .where(eq(sales.id, id))
      .returning();

    return result[0];
  }

  async bulkRecordLPO(params: { saleIds: string[]; lpoNumber: string; lpoReceivedDate?: Date }): Promise<{ updated: number; errors: string[] }> {
    const { saleIds, lpoNumber, lpoReceivedDate } = params;
    const errors: string[] = [];
    let updated = 0;
    const receivedDate = lpoReceivedDate || new Date();
    for (const id of saleIds) {
      try {
        const sale = await this.getSale(id);
        if (!sale) {
          errors.push(`Sale ${id} not found`);
          continue;
        }
        const { client, project, ...saleFields } = sale as SaleWithClient & { client?: unknown; project?: unknown };
        const payload: InsertSale = {
          clientId: saleFields.clientId,
          projectId: saleFields.projectId,
          saleDate: saleFields.saleDate,
          quantityGallons: saleFields.quantityGallons,
          salePricePerGallon: saleFields.salePricePerGallon,
          purchasePricePerGallon: saleFields.purchasePricePerGallon,
          lpoNumber,
          deliveryNoteNumber: saleFields.deliveryNoteNumber ?? "",
          lpoReceivedDate: receivedDate,
          invoiceDate: saleFields.invoiceDate,
          saleStatus: "LPO Received",
          vatPercentage: saleFields.vatPercentage,
        };
        const updatedSale = await this.updateSale(id, payload);
        if (updatedSale) updated++;
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { updated, errors };
  }

  async getPendingBusinessReport(clientId?: string, dateFrom?: string, dateTo?: string): Promise<SaleWithClient[]> {
    let conditions = [sql`${sales.saleStatus} IN ('Pending LPO', 'LPO Received')`];
    
    if (clientId) {
      conditions.push(eq(sales.clientId, clientId));
    }
    
    if (dateFrom) {
      conditions.push(gte(sales.saleDate, startOfDayFromYmd(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(sales.saleDate, endOfDayFromYmd(dateTo)));
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
        deliveryNoteNumber: sales.deliveryNoteNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
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
      conditions.push(gte(sales.saleDate, startOfDayFromYmd(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(sales.saleDate, endOfDayFromYmd(dateTo)));
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
        deliveryNoteNumber: sales.deliveryNoteNumber,
        lpoReceivedDate: sales.lpoReceivedDate,
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

  // Cashbook Payment Allocation methods
  async getCashbookPaymentAllocations(): Promise<CashbookPaymentAllocationWithInvoice[]> {
    const result = await db
      .select({
        id: cashbookPaymentAllocations.id,
        cashbookEntryId: cashbookPaymentAllocations.cashbookEntryId,
        invoiceId: cashbookPaymentAllocations.invoiceId,
        amountAllocated: cashbookPaymentAllocations.amountAllocated,
        createdAt: cashbookPaymentAllocations.createdAt,
        invoice: invoices,
        sale: sales,
        client: clients,
        project: projects,
      })
      .from(cashbookPaymentAllocations)
      .leftJoin(invoices, eq(cashbookPaymentAllocations.invoiceId, invoices.id))
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .orderBy(desc(cashbookPaymentAllocations.createdAt));

    return result.map(r => ({
      ...r,
      invoice: {
        ...r.invoice!,
        sale: {
          ...r.sale!,
          client: r.client!,
          project: r.project!
        }
      }
    }));
  }

  async createCashbookPaymentAllocation(allocation: InsertCashbookPaymentAllocation): Promise<CashbookPaymentAllocation> {
    // Validate that the cashbook entry exists and has sufficient unallocated amount
    const cashbookEntry = await this.getCashbookEntry(allocation.cashbookEntryId);
    if (!cashbookEntry) {
      throw new Error("Cashbook entry not found");
    }

    const cashbookEntryAllocatedAmount = await this.getCashbookEntryAllocatedAmount(allocation.cashbookEntryId);
    const cashbookEntryAmount = parseFloat(cashbookEntry.amount);
    const remainingCashbookAmount = cashbookEntryAmount - cashbookEntryAllocatedAmount;
    const allocationAmount = parseFloat(allocation.amountAllocated);

    if (allocationAmount > remainingCashbookAmount) {
      throw new Error(`Cannot allocate AED ${allocationAmount.toFixed(2)}. Only AED ${remainingCashbookAmount.toFixed(2)} remains unallocated in this cashbook entry.`);
    }

    // Validate that allocation doesn't exceed invoice pending amount
    const invoice = await this.getInvoice(allocation.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const currentAllocatedAmount = await this.getInvoiceAllocatedAmount(allocation.invoiceId);
    const totalAmount = parseFloat(invoice.totalAmount);
    const pendingAmount = totalAmount - currentAllocatedAmount;

    if (allocationAmount > pendingAmount) {
      throw new Error(`Cannot allocate AED ${allocationAmount.toFixed(2)} to invoice ${invoice.invoiceNumber}. Pending amount is only AED ${pendingAmount.toFixed(2)}`);
    }

    // Create the allocation without transaction (for Neon HTTP driver compatibility)
    const allocationResult = await db.insert(cashbookPaymentAllocations).values(allocation).returning();
    
    // Update invoice status if fully paid
    await this.updateInvoiceStatusIfPaid(allocation.invoiceId);
    
    return allocationResult[0];
  }

  async getCashbookPaymentAllocationsByEntry(cashbookEntryId: string): Promise<CashbookPaymentAllocationWithInvoice[]> {
    const result = await db
      .select({
        id: cashbookPaymentAllocations.id,
        cashbookEntryId: cashbookPaymentAllocations.cashbookEntryId,
        invoiceId: cashbookPaymentAllocations.invoiceId,
        amountAllocated: cashbookPaymentAllocations.amountAllocated,
        createdAt: cashbookPaymentAllocations.createdAt,
        invoice: invoices,
        sale: sales,
        client: clients,
        project: projects,
      })
      .from(cashbookPaymentAllocations)
      .leftJoin(invoices, eq(cashbookPaymentAllocations.invoiceId, invoices.id))
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(eq(cashbookPaymentAllocations.cashbookEntryId, cashbookEntryId))
      .orderBy(desc(cashbookPaymentAllocations.createdAt));

    return result.map(r => ({
      ...r,
      invoice: {
        ...r.invoice!,
        sale: {
          ...r.sale!,
          client: r.client!,
          project: r.project!
        }
      }
    }));
  }

  async getPendingInvoicesForAllocation(accountHeadId?: string): Promise<any[]> {
    // If accountHeadId is provided, filter by client
    let clientId: string | undefined;
    if (accountHeadId) {
      // Get the account head to find the client
      const accountHeadResult = await db
        .select()
        .from(accountHeads)
        .where(eq(accountHeads.id, accountHeadId))
        .limit(1);
      
      const accountHead = accountHeadResult[0];
      if (accountHead && accountHead.type === "Client") {
        // Find the client by name (assuming account head name matches client name)
        const clientResult = await db
          .select()
          .from(clients)
          .where(eq(clients.name, accountHead.name))
          .limit(1);
        
        if (clientResult[0]) {
          clientId = clientResult[0].id;
        }
      }
    }

    // Build the query with conditional client filter
    const result = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        saleId: invoices.saleId,
        sale: sales,
        client: clients,
        project: projects
      })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(projects, eq(sales.projectId, projects.id))
      .where(
        clientId
          ? and(inArray(invoices.status, ["Generated", "Sent"]), eq(sales.clientId, clientId))
          : inArray(invoices.status, ["Generated", "Sent"]),
      );

    // Calculate allocated amounts and build final result
    const invoicesWithAllocations = await Promise.all(
      result.map(async (row) => {
        const allocatedAmount = await this.getInvoiceAllocatedAmount(row.id);
        const pendingAmount = parseFloat(row.totalAmount) - allocatedAmount;
        
        return {
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          invoiceDate: row.invoiceDate,
          totalAmount: row.totalAmount,
          status: row.status,
          allocatedAmount: allocatedAmount,
          pendingAmount: pendingAmount,
          sale: row.sale ? {
            ...row.sale,
            client: row.client,
            project: row.project
          } : null
        };
      })
    );

    // Only return invoices with pending amounts
    return invoicesWithAllocations.filter(invoice => invoice.pendingAmount > 0);
  }

  async getInvoiceAllocatedAmount(invoiceId: string): Promise<number> {
    const result = await db
      .select({
        allocatedAmount: sql<number>`COALESCE(SUM(${cashbookPaymentAllocations.amountAllocated})::numeric, 0)`,
      })
      .from(cashbookPaymentAllocations)
      .where(eq(cashbookPaymentAllocations.invoiceId, invoiceId));

    return result[0]?.allocatedAmount || 0;
  }

  async getCashbookEntryAllocatedAmount(cashbookEntryId: string): Promise<number> {
    const result = await db
      .select({
        allocatedAmount: sql<number>`COALESCE(SUM(${cashbookPaymentAllocations.amountAllocated})::numeric, 0)`,
      })
      .from(cashbookPaymentAllocations)
      .where(eq(cashbookPaymentAllocations.cashbookEntryId, cashbookEntryId));

    return result[0]?.allocatedAmount || 0;
  }

  async updateInvoiceStatusIfPaid(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) return;

    const allocatedAmount = await this.getInvoiceAllocatedAmount(invoiceId);
    const totalAmount = parseFloat(invoice.totalAmount);

    if (allocatedAmount >= totalAmount) {
      await db
        .update(invoices)
        .set({ status: "Paid" })
        .where(eq(invoices.id, invoiceId));
    }
  }

  // Supplier Debt Tracking methods
  async getSupplierDebts(): Promise<CashbookEntryWithAccountHead[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Supplier"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  async getSupplierOutstandingBalance(supplierId: string): Promise<number> {
    const result = await db.select({
      totalDebt: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.accountHeadId} = ${supplierId} AND ${cashbook.isPending} = 1 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`
    }).from(cashbook);
    return result[0]?.totalDebt || 0;
  }

  async getSupplierPaymentHistory(supplierId: string): Promise<CashbookEntry[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Supplier"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  // Client Payment Tracking methods
  async getClientPayments(): Promise<CashbookEntryWithAccountHead[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Client"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  async getClientOutstandingBalance(clientId: string): Promise<number> {
    const result = await db.select({
      totalDebt: sql<number>`COALESCE(SUM(CASE WHEN ${cashbook.accountHeadId} = ${clientId} AND ${cashbook.isPending} = 1 THEN ${cashbook.amount}::numeric ELSE 0 END), 0)`
    }).from(cashbook);
    return result[0]?.totalDebt || 0;
  }

  async getClientPaymentHistory(clientId: string): Promise<CashbookEntry[]> {
    const result = await db
      .select({
        id: cashbook.id,
        transactionDate: cashbook.transactionDate,
        transactionType: cashbook.transactionType,
        category: cashbook.category,
        accountHeadId: cashbook.accountHeadId,
        amount: cashbook.amount,
        isInflow: cashbook.isInflow,
        description: cashbook.description,
        counterparty: cashbook.counterparty,
        paymentMethod: cashbook.paymentMethod,
        referenceType: cashbook.referenceType,
        referenceId: cashbook.referenceId,
        isPending: cashbook.isPending,
        notes: cashbook.notes,
        createdAt: cashbook.createdAt,
        accountHead: accountHeads,
      })
      .from(cashbook)
      .leftJoin(accountHeads, eq(cashbook.accountHeadId, accountHeads.id))
      .where(eq(accountHeads.type, "Client"))
      .orderBy(desc(cashbook.transactionDate));

    return result.map(r => ({
      ...r,
      accountHead: r.accountHead!,
    }));
  }

  async getOverdueClientPayments(daysThreshold: number): Promise<{
    client: Client;
    invoices: Array<{
      id: string;
      invoiceNumber: string | null;
      invoiceDate: Date | null;
      submissionDate: Date | null;
      dueDate: Date | null;
      pendingAmount: number;
      totalAmount: number;
    }>;
    totalPending: number;
  }[]> {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Fetch candidate invoices that are still not marked Paid
    const rows = await db
      .select({
        invoice: invoices,
        sale: sales,
        client: clients,
      })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .leftJoin(clients, eq(sales.clientId, clients.id));

    // Overdue = unpaid with pending balance; due from stored due_date or submission/invoice + 1 month.
    // Only clients overdue by *more than* daysThreshold calendar days past due date.
    const perClient: Record<
      string,
      {
        client: Client;
        invoices: Array<{
          id: string;
          invoiceNumber: string | null;
          invoiceDate: Date | null;
          submissionDate: Date | null;
          dueDate: Date | null;
          pendingAmount: number;
          totalAmount: number;
        }>;
        totalPending: number;
      }
    > = {};

    for (const r of rows) {
      if (!r.invoice || !r.sale || !r.client) continue;
      if (r.invoice.status === 'Paid') continue;
      const invDate = r.invoice.invoiceDate ? new Date(r.invoice.invoiceDate as Date) : null;
      const subDate = r.invoice.submissionDate ? new Date(r.invoice.submissionDate as Date) : null;
      const dueDate = effectiveDueDateForInvoice(r.invoice);
      if (!dueDate) continue;
      const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      if (dueStart >= todayStart) continue;
      const daysPastDue = Math.floor((todayStart.getTime() - dueStart.getTime()) / 86400000);
      if (daysPastDue <= daysThreshold) continue;

      const allocated = await this.getInvoiceAllocatedAmount(r.invoice.id);
      const totalAmt = parseFloat(r.invoice.totalAmount);
      const pending = totalAmt - allocated;
      if (pending <= 0) continue;

      const clientId = r.client.id;
      if (!perClient[clientId]) {
        perClient[clientId] = { client: r.client, invoices: [], totalPending: 0 };
      }
      perClient[clientId].invoices.push({
        id: r.invoice.id,
        invoiceNumber: r.invoice.invoiceNumber,
        invoiceDate: invDate,
        submissionDate: subDate,
        dueDate,
        pendingAmount: parseFloat(pending.toFixed(2)),
        totalAmount: totalAmt,
      });
      perClient[clientId].totalPending = parseFloat((perClient[clientId].totalPending + pending).toFixed(2));
    }

    return Object.values(perClient).sort((a, b) => b.totalPending - a.totalPending);
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
    // Remove supplier advance allocations that reference this stock
    await db.delete(supplierAdvanceAllocations).where(eq(supplierAdvanceAllocations.stockId, id));
    // Remove cashbook entries linked to this stock (purchase outflow + any unsettled debt)
    await db.delete(cashbook).where(and(eq(cashbook.referenceType, "stock"), eq(cashbook.referenceId, id)));
    const result = await db
      .delete(stock)
      .where(eq(stock.id, id))
      .returning();

    if (result.length > 0) {
      await this.reapplyFIFOCostsToAllSales();
    }
    return result.length > 0;
  }

  async deleteSale(id: string): Promise<boolean> {
    try {
      console.log(`Starting deletion of sale: ${id}`);
      
      // Get the sale first to understand what we're deleting
      const sale = await db
        .select()
        .from(sales)
        .where(eq(sales.id, id))
        .limit(1);

      if (sale.length === 0) {
        console.log(`Sale not found: ${id}`);
        return false;
      }

      console.log(`Found sale: ${sale[0].lpoNumber || 'No LPO'} for client`);

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Delete all cashbook payment allocations for invoices of this sale
      const saleInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.saleId, id));

      console.log(`Found ${saleInvoices.length} invoices to delete`);

      for (const invoice of saleInvoices) {
        // Delete allocations for this invoice
        await db
          .delete(cashbookPaymentAllocations)
          .where(eq(cashbookPaymentAllocations.invoiceId, invoice.id));
        console.log(`Deleted cashbook payment allocations for invoice: ${invoice.invoiceNumber}`);
      }

      // 2. Delete all cashbook entries related to payments for this sale
      const salePayments = await db
        .select()
        .from(payments)
        .where(eq(payments.saleId, id));

      console.log(`Found ${salePayments.length} payments to delete`);

      for (const payment of salePayments) {
        // Delete cashbook entries for this payment
        await db
          .delete(cashbook)
          .where(and(
            eq(cashbook.referenceType, "payment"),
            eq(cashbook.referenceId, payment.id)
          ));
        console.log(`Deleted cashbook entry for payment: ${payment.id}`);
      }

      // 3. Delete all payments for this sale
      await db
        .delete(payments)
        .where(eq(payments.saleId, id));
      console.log(`Deleted ${salePayments.length} payments`);

      // 4. Delete all invoices for this sale
      await db
        .delete(invoices)
        .where(eq(invoices.saleId, id));
      console.log(`Deleted ${saleInvoices.length} invoices`);

      // 5. Delete the sale itself
      const result = await db
        .delete(sales)
        .where(eq(sales.id, id))
        .returning();

      if (result.length === 0) {
        console.log(`Sale deletion completed: FAILED`);
        return false;
      }

      await this.reapplyFIFOCostsToAllSales();

      console.log(`Sale deletion completed: SUCCESS`);
      return true;
    } catch (error) {
      console.error("Error deleting sale:", error);
      throw error;
    }
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
    try {
      console.log(`Starting deletion of invoice: ${id}`);
      
      // First, get the invoice to check if it exists
      const invoice = await this.getInvoice(id);
      if (!invoice) {
        console.log(`Invoice not found: ${id}`);
        return false;
      }

      console.log(`Found invoice: ${invoice.invoiceNumber} for sale: ${invoice.saleId}`);

      // Check if there are any allocations/payments associated with this invoice
      const allocs = await db
        .select()
        .from(cashbookPaymentAllocations)
        .where(eq(cashbookPaymentAllocations.invoiceId, id));
      if (allocs.length > 0) {
        console.log(`Cannot delete invoice: allocations exist`);
        throw new Error("Cannot delete invoice: Allocations/payments have been made for this invoice");
      }

      // Find linked sales to revert their status
      const links = await db.select().from(invoiceSales).where(eq(invoiceSales.invoiceId, id));
      const saleIdsToRevert = links.map(l => l.saleId);
      console.log(`No allocations found, proceeding with deletion`);

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      console.log(`Starting invoice deletion process`);
      
      // 1. Delete invoice-sales links
      await db.delete(invoiceSales).where(eq(invoiceSales.invoiceId, id));

      // 2. Delete the invoice from the database
      const deleteResult = await db
        .delete(invoices)
        .where(eq(invoices.id, id))
        .returning();
      console.log(`Deleted invoice: ${deleteResult.length > 0 ? 'SUCCESS' : 'FAILED'}`);

      // 3. Revert linked sales back to "LPO Received" so they can be re-invoiced
      if (deleteResult.length > 0 && saleIdsToRevert.length) {
        for (const sid of saleIdsToRevert) {
          await db.update(sales).set({ saleStatus: "LPO Received" }).where(eq(sales.id, sid));
        }
      }

      console.log(`Invoice deletion completed: ${deleteResult.length > 0 ? 'SUCCESS' : 'FAILED'}`);
      return deleteResult.length > 0;
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  }



  async deletePayment(id: string): Promise<boolean> {
    try {
      // Get the payment first to understand what we're deleting
      const payment = await db
        .select()
        .from(payments)
        .where(eq(payments.id, id))
        .limit(1);

      if (payment.length === 0) {
        return false;
      }

      // Delete operations without transaction (for Neon HTTP driver compatibility)
      // 1. Delete all cashbook payment allocations related to this payment's cashbook entry
      const cashbookEntry = await db
        .select()
        .from(cashbook)
        .where(and(
          eq(cashbook.referenceType, "payment"),
          eq(cashbook.referenceId, id)
        ))
        .limit(1);

      if (cashbookEntry.length > 0) {
        // Delete all allocations for this cashbook entry
        await db
          .delete(cashbookPaymentAllocations)
          .where(eq(cashbookPaymentAllocations.cashbookEntryId, cashbookEntry[0].id));
      }

      // 2. Delete the associated cashbook entry
      await db
        .delete(cashbook)
        .where(and(
          eq(cashbook.referenceType, "payment"),
          eq(cashbook.referenceId, id)
        ));

      // 3. Delete the payment
      const result = await db
        .delete(payments)
        .where(eq(payments.id, id))
        .returning();

      // 4. Update sale status if needed
      if (result.length > 0) {
        const sale = await db
          .select()
          .from(sales)
          .where(eq(sales.id, payment[0].saleId))
          .limit(1);

        if (sale.length > 0) {
          // Check if there are any remaining payments for this sale
          const remainingPayments = await db
            .select()
            .from(payments)
            .where(eq(payments.saleId, payment[0].saleId));

          if (remainingPayments.length === 0) {
            // No payments left, revert sale status to "Invoiced" if it was "Paid"
            if (sale[0].saleStatus === "Paid") {
              await db
                .update(sales)
                .set({ saleStatus: "Invoiced" })
                .where(eq(sales.id, payment[0].saleId));
            }
          } else {
            // Recalculate total paid and update status
            const totalPaid = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amountReceived), 0);
            const saleTotal = parseFloat(sale[0].totalAmount);
            
            let newStatus = sale[0].saleStatus;
            if (totalPaid >= saleTotal) {
              newStatus = "Paid";
            } else if (sale[0].saleStatus === "Paid") {
              newStatus = "Invoiced";
            }

            if (newStatus !== sale[0].saleStatus) {
              await db
                .update(sales)
                .set({ saleStatus: newStatus })
                .where(eq(sales.id, payment[0].saleId));
            }
          }
        }
      }

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting payment:", error);
      throw error;
    }
  }

  async migratePaymentsToCashbook(): Promise<number> {
    // Get all payments that don't have corresponding cashbook entries
    const allPayments = await this.getPayments();
    let migratedCount = 0;

    for (const payment of allPayments) {
      // Check if cashbook entry already exists for this payment
      const existingCashbookEntry = await db
        .select()
        .from(cashbook)
        .where(and(
          eq(cashbook.referenceType, "payment"),
          eq(cashbook.referenceId, payment.id)
        ))
        .limit(1);

      if (existingCashbookEntry.length === 0) {
        // Create cashbook entry for this payment
        const client = payment.sale.client;
        
        let clientAccountHead = await db.select().from(accountHeads).where(eq(accountHeads.name, client.name)).limit(1);
        if (!clientAccountHead[0]) {
          clientAccountHead = [await this.createAccountHead({
            name: client.name,
            type: "Client",
          })];
        }

        await this.createCashbookEntry({
          transactionDate: payment.paymentDate,
          transactionType: "Sale Revenue",
          accountHeadId: clientAccountHead[0].id,
          amount: parseFloat(payment.amountReceived).toFixed(2),
          isInflow: 1,
          description: `Payment received from ${client.name} for LPO ${payment.sale.lpoNumber || "N/A"}`,
          counterparty: client.name,
          paymentMethod: payment.paymentMethod,
          referenceType: "payment",
          referenceId: payment.id,
          isPending: 0,
          notes: `Amount: ${payment.amountReceived}`
        });

        migratedCount++;
      }
    }

    return migratedCount;
  }

  async getBusinessSettings(): Promise<BusinessSettings> {
    const result = await db.select().from(businessSettings).limit(1);
    
    if (result.length === 0) {
      // Create default settings if none exist
      const defaultSettings = await db.insert(businessSettings).values({}).returning();
      return defaultSettings[0];
    }
    
    return result[0];
  }

  async updateBusinessSettings(settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings> {
    const existing = await this.getBusinessSettings();
    
    const updated = await db
      .update(businessSettings)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(eq(businessSettings.id, existing.id))
      .returning();
    
    return updated[0];
  }
}

export const storage = new DatabaseStorage();
