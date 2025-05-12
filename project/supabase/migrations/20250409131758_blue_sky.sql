-- Add retail price columns
ALTER TABLE products
ADD COLUMN IF NOT EXISTS retail_price_ht numeric(10,2),
ADD COLUMN IF NOT EXISTS retail_margin numeric(10,2),
ADD COLUMN IF NOT EXISTS retail_price_ttc numeric(10,2),
ADD COLUMN IF NOT EXISTS retail_margin_net numeric(10,2);

-- Add pro price columns
ALTER TABLE products
ADD COLUMN IF NOT EXISTS pro_price_ht numeric(10,2),
ADD COLUMN IF NOT EXISTS pro_margin numeric(10,2),
ADD COLUMN IF NOT EXISTS pro_price_ttc numeric(10,2),
ADD COLUMN IF NOT EXISTS pro_margin_net numeric(10,2);

-- Add comments for documentation
COMMENT ON COLUMN products.retail_price_ht IS 'Retail price before tax (HT) for normal VAT';
COMMENT ON COLUMN products.retail_margin IS 'Retail margin percentage';
COMMENT ON COLUMN products.retail_price_ttc IS 'Retail price with tax (TTC) for normal VAT';
COMMENT ON COLUMN products.retail_margin_net IS 'Net margin amount for margin VAT';

COMMENT ON COLUMN products.pro_price_ht IS 'Pro price before tax (HT) for normal VAT';
COMMENT ON COLUMN products.pro_margin IS 'Pro margin percentage';
COMMENT ON COLUMN products.pro_price_ttc IS 'Pro price with tax (TTC) for normal VAT';
COMMENT ON COLUMN products.pro_margin_net IS 'Net margin amount for margin VAT';