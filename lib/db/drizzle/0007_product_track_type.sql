ALTER TABLE products
  ADD COLUMN IF NOT EXISTS track_type TEXT NOT NULL DEFAULT 'technical';

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_track_type_check;

ALTER TABLE products
  ADD CONSTRAINT products_track_type_check
  CHECK (track_type IN ('business', 'technical'));
