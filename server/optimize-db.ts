import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

// Initialize database connection
const connectionString = process.env.DATABASE_URL || "";
const sql_conn = neon(connectionString);
const db = drizzle(sql_conn);

async function createIndexes() {
  console.log("Creating database indexes for better performance...");
  
  try {
    // Stock table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_created_at ON stock(created_at DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_purchase_date ON stock(purchase_date DESC)`);
    
    // Sales table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_sale_date ON sales(sale_date DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_client_id ON sales(client_id)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_project_id ON sales(project_id)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_status ON sales(sale_status)`);
    
    // Clients table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_name ON clients(name)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC)`);
    
    // Projects table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_client_id ON projects(client_id)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status ON projects(status)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC)`);
    
    // Payments table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_sale_id ON payments(sale_id)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC)`);
    
    // Invoices table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_sale_id ON invoices(sale_id)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_status ON invoices(status)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC)`);
    
    // Cashbook table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cashbook_transaction_date ON cashbook(transaction_date DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cashbook_transaction_type ON cashbook(transaction_type)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cashbook_account_head_id ON cashbook(account_head_id)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cashbook_created_at ON cashbook(created_at DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cashbook_reference ON cashbook(reference_type, reference_id)`);
    
    // Account heads table indexes
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_heads_type ON account_heads(type)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_heads_name ON account_heads(name)`);
    
    // Composite indexes for common queries
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_client_date ON sales(client_id, sale_date DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_project_date ON sales(project_id, sale_date DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cashbook_date_type ON cashbook(transaction_date DESC, transaction_type)`);
    
    console.log("✅ Database indexes created successfully!");
    
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { createIndexes };