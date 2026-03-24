-- Widen internal cost fields on sales (idempotent if already applied via schema-patches).
-- PostgreSQL preserves numeric values; e.g. 12.34 (2dp) becomes 12.3400 (4dp).
ALTER TABLE sales ALTER COLUMN cogs TYPE NUMERIC(16,4) USING cogs::numeric;
ALTER TABLE sales ALTER COLUMN gross_profit TYPE NUMERIC(16,4) USING gross_profit::numeric;
ALTER TABLE sales ALTER COLUMN purchase_price_per_gallon TYPE NUMERIC(12,6) USING purchase_price_per_gallon::numeric;
