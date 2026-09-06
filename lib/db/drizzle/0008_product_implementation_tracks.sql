ALTER TABLE implementation_stages
  ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS implementation_stages_bank_track_order_idx;

CREATE UNIQUE INDEX IF NOT EXISTS implementation_stages_bank_track_order_idx
  ON implementation_stages (bank_id, track_type, display_order)
  WHERE product_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS implementation_stages_product_track_order_idx
  ON implementation_stages (bank_id, product_id, track_type, display_order)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS implementation_stages_product_track_idx
  ON implementation_stages (bank_id, product_id, track_type, display_order);
