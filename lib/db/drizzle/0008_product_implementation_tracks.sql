ALTER TABLE implementation_stages
  ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS implementation_stages_product_track_idx
  ON implementation_stages (bank_id, product_id, track_type, display_order);
