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
}
