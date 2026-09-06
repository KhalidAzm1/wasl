ALTER TABLE implementation_stages
  ADD COLUMN IF NOT EXISTS track_type TEXT NOT NULL DEFAULT 'business';

CREATE UNIQUE INDEX IF NOT EXISTS implementation_stages_bank_track_order_idx
  ON implementation_stages (bank_id, track_type, display_order);
