import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const stock = pgTable("stock", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseDate: timestamp("purchase_date").notNull(),
  quantityGallons: decimal("quantity_gallons", { precision: 10, scale: 2 }).notNull(),
  purchasePricePerGallon: decimal("purchase_price_per_gallon", { precision: 8, scale: 3 }).notNull(),
  vatPercentage: decimal("vat_percentage", { precision: 5, scale: 2 }).notNull().default("5.00"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactPerson: text("contact_person").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  status: text("status").notNull().default("Active"), // "Active", "Completed", "On Hold"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  saleDate: timestamp("sale_date").notNull(),
  quantityGallons: decimal("quantity_gallons", { precision: 10, scale: 2 }).notNull(),
  salePricePerGallon: decimal("sale_price_per_gallon", { precision: 8, scale: 3 }).notNull(),
  purchasePricePerGallon: decimal("purchase_price_per_gallon", { precision: 8, scale: 3 }).notNull(),
  lpoNumber: text("lpo_number"),
  lpoReceivedDate: timestamp("lpo_received_date"),
  lpoDueDate: timestamp("lpo_due_date"),
  invoiceDate: timestamp("invoice_date"),
  saleStatus: text("sale_status").notNull().default("Pending LPO"), // "Pending LPO", "LPO Received", "Invoiced", "Paid"
  vatPercentage: decimal("vat_percentage", { precision: 5, scale: 2 }).notNull().default("5.00"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  cogs: decimal("cogs", { precision: 12, scale: 2 }).notNull(), // Cost of Goods Sold
  grossProfit: decimal("gross_profit", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  invoiceDate: timestamp("invoice_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("Generated"), // "Generated", "Sent", "Paid"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  amountReceived: decimal("amount_received", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // "Cheque", "Bank Transfer", "Cash"
  chequeNumber: text("cheque_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cashbook = pgTable("cashbook", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionDate: timestamp("transaction_date").notNull(),
  transactionType: text("transaction_type").notNull(), // "Investment", "Profit Withdrawal", "Stock Purchase", "Sale Revenue", "Expense", "Other"
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  isInflow: integer("is_inflow").notNull(), // 1 for inflow, 0 for outflow
  description: text("description").notNull(),
  referenceType: text("reference_type"), // "sale", "stock", "manual"
  referenceId: uuid("reference_id"), // ID of related sale/stock if applicable
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertStockSchema = createInsertSchema(stock).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  subtotal: true,
  vatAmount: true,
  totalAmount: true,
  cogs: true,
  grossProfit: true,
});

export const insertCashbookSchema = createInsertSchema(cashbook).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStock = z.infer<typeof insertStockSchema>;
export type Stock = typeof stock.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export type InsertCashbook = z.infer<typeof insertCashbookSchema>;
export type CashbookEntry = typeof cashbook.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Additional types for joined data
export type SaleWithClient = Sale & {
  client: Client;
  project: Project;
};

export type ProjectWithClient = Project & {
  client: Client;
};

export type PaymentWithSaleAndClient = Payment & {
  sale: Sale & {
    client: Client;
  };
};
