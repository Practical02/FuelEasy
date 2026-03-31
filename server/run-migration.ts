/**
 * Run from repo root: npx tsx --env-file=.env server/run-migration.ts
 * Applies migrations/001_add_invoices_due_date.sql logic (via applySchemaPatches).
 */
import { applySchemaPatches } from "./schema-patches";

async function main() {
  await applySchemaPatches();
  console.log("Migration completed: schema patches ensured.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});
