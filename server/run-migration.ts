/**
 * Run from repo root: npx tsx --env-file=.env server/run-migration.ts
 * Applies migrations/001_add_invoices_due_date.sql logic (via applySchemaPatches).
 */
import { applySchemaPatches } from "./schema-patches";

await applySchemaPatches();
console.log("Migration completed: invoices.due_date is ensured.");
