import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

/**
 * Idempotent DDL for databases that were created before a column existed in shared/schema.ts.
 * Runs once at server startup so ORM queries (e.g. delete sale → load invoices) match the DB.
 */
export async function applySchemaPatches(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || "";
  if (!connectionString) {
    console.warn("applySchemaPatches: DATABASE_URL not set, skipping");
    return;
  }

  const sql_conn = neon(connectionString);
  const db = drizzle(sql_conn);

  try {
    await db.execute(
      sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP`
    );
  } catch (e) {
    console.error("applySchemaPatches: failed to ensure invoices.due_date:", e);
    throw e;
  }

  try {
    await db.execute(
      sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP`
    );
  } catch (e) {
    console.error("applySchemaPatches: failed to ensure invoices.submission_date:", e);
    throw e;
  }

  try {
    await db.execute(
      sql`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS zigma_invoice_prefix TEXT NOT NULL DEFAULT 'ZDT-'`
    );
  } catch (e) {
    console.error("applySchemaPatches: failed to ensure business_settings.zigma_invoice_prefix:", e);
    throw e;
  }

  try {
    await db.execute(
      sql`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS sayan_invoice_prefix TEXT NOT NULL DEFAULT 'SYN-'`
    );
  } catch (e) {
    console.error("applySchemaPatches: failed to ensure business_settings.sayan_invoice_prefix:", e);
    throw e;
  }

  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS sales_delivery_note_unique_norm
      ON sales (lower(trim(delivery_note_number)))
      WHERE delivery_note_number IS NOT NULL AND trim(delivery_note_number) <> ''
    `);
  } catch (e) {
    console.warn(
      "applySchemaPatches: could not create unique index on delivery_note_number (duplicates in DB?). In-app checks still apply:",
      e,
    );
  }

  // Widen cost columns (no data loss: existing values keep the same numeric value)
  try {
    await db.execute(
      sql`ALTER TABLE sales ALTER COLUMN cogs TYPE NUMERIC(16,4) USING cogs::numeric`,
    );
  } catch (e) {
    console.error("applySchemaPatches: failed to widen sales.cogs:", e);
    throw e;
  }
  try {
    await db.execute(
      sql`ALTER TABLE sales ALTER COLUMN gross_profit TYPE NUMERIC(16,4) USING gross_profit::numeric`,
    );
  } catch (e) {
    console.error("applySchemaPatches: failed to widen sales.gross_profit:", e);
    throw e;
  }
  try {
    await db.execute(
      sql`ALTER TABLE sales ALTER COLUMN purchase_price_per_gallon TYPE NUMERIC(12,6) USING purchase_price_per_gallon::numeric`,
    );
  } catch (e) {
    console.error("applySchemaPatches: failed to widen sales.purchase_price_per_gallon:", e);
    throw e;
  }
}
