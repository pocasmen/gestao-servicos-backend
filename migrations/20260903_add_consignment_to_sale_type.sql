-- Migration: Add CONSIGNMENT to parts_sales sale_type check constraint
-- Date: 2026-09-03

ALTER TABLE parts_sales DROP CONSTRAINT IF EXISTS parts_sales_sale_type_check;
ALTER TABLE parts_sales ADD CONSTRAINT parts_sales_sale_type_check CHECK (sale_type IN ('SALE', 'GIVEAWAY', 'DISCARD', 'RETURN', 'CONSIGNMENT'));
