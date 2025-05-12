/*
  # Add price and margin columns to products table

  1. Changes
    - Add retail_price_ht, retail_margin, retail_price_ttc, retail_margin_net columns
    - Add pro_price_ht, pro_margin, pro_price_ttc, pro_margin_net columns
    - Add comments for documentation
  
  2. Notes
    - All columns use numeric(10,2) for consistent decimal handling
    - No constraints are modified in this migration
    - Existing constraints are preserved
*/

-- Add retail price columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'retail_price_ht'
  ) THEN
    ALTER TABLE products ADD COLUMN retail_price_ht numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'retail_margin'
  ) THEN
    ALTER TABLE products ADD COLUMN retail_margin numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'retail_price_ttc'
  ) THEN
    ALTER TABLE products ADD COLUMN retail_price_ttc numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'retail_margin_net'
  ) THEN
    ALTER TABLE products ADD COLUMN retail_margin_net numeric(10,2);
  END IF;

  -- Add pro price columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'pro_price_ht'
  ) THEN
    ALTER TABLE products ADD COLUMN pro_price_ht numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'pro_margin'
  ) THEN
    ALTER TABLE products ADD COLUMN pro_margin numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'pro_price_ttc'
  ) THEN
    ALTER TABLE products ADD COLUMN pro_price_ttc numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'pro_margin_net'
  ) THEN
    ALTER TABLE products ADD COLUMN pro_margin_net numeric(10,2);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN products.retail_price_ht IS 'Retail price before tax (HT) for normal VAT';
COMMENT ON COLUMN products.retail_margin IS 'Retail margin percentage';
COMMENT ON COLUMN products.retail_price_ttc IS 'Retail price with tax (TTC) for normal VAT';
COMMENT ON COLUMN products.retail_margin_net IS 'Net margin amount for margin VAT';

COMMENT ON COLUMN products.pro_price_ht IS 'Pro price before tax (HT) for normal VAT';
COMMENT ON COLUMN products.pro_margin IS 'Pro margin percentage';
COMMENT ON COLUMN products.pro_price_ttc IS 'Pro price with tax (TTC) for normal VAT';
COMMENT ON COLUMN products.pro_margin_net IS 'Net margin amount for margin VAT';