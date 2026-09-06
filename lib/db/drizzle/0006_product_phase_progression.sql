ALTER TABLE product_stages
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;

-- Give every existing product without stages its own independent default track.
INSERT INTO product_stages
  (product_id, name, display_order, completed, is_current, created_at, updated_at)
SELECT product.id, phase.name, phase.display_order, FALSE,
       phase.display_order = 0, NOW(), NOW()
FROM products AS product
CROSS JOIN (VALUES
  ('Kick-Off', 0),
  ('Analysis', 1),
  ('Development and Integration', 2),
  ('Testing', 3),
  ('Rollout', 4)
) AS phase(name, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM product_stages existing
  WHERE existing.product_id = product.id
);

WITH first_open_stage AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY display_order, created_at) AS position
  FROM product_stages
  WHERE completed = FALSE
)
UPDATE product_stages AS stage
SET is_current = TRUE
FROM first_open_stage
WHERE stage.id = first_open_stage.id
  AND first_open_stage.position = 1
  AND NOT EXISTS (
    SELECT 1 FROM product_stages existing
    WHERE existing.product_id = stage.product_id AND existing.is_current = TRUE
  );

CREATE TABLE IF NOT EXISTS product_phase_history (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_stage_id   INTEGER REFERENCES product_stages(id) ON DELETE SET NULL,
  from_stage_name TEXT,
  to_stage_id     INTEGER REFERENCES product_stages(id) ON DELETE SET NULL,
  to_stage_name   TEXT NOT NULL,
  changed_by_id   TEXT,
  changed_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_phase_history_product_idx
  ON product_phase_history (product_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS product_stages_one_current_idx
  ON product_stages (product_id) WHERE is_current = TRUE;
