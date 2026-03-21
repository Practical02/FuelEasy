-- Run in Neon SQL Editor if you prefer not to rely on server startup patches.
-- Matches shared/schema.ts invoices.dueDate
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
