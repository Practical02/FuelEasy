-- Align legacy rows: any invoice with a submission date should be Sent, not Generated.
UPDATE invoices
SET status = 'Sent'
WHERE submission_date IS NOT NULL
  AND status = 'Generated';
