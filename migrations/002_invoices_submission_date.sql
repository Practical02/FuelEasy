-- When invoice was sent to client; drives payment due/reminders with due_date.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP;
