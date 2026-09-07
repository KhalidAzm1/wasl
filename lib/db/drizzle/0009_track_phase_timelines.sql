ALTER TABLE implementation_stages
  ADD COLUMN IF NOT EXISTS started_at TEXT,
  ADD COLUMN IF NOT EXISTS planned_days INTEGER;

UPDATE implementation_stages
SET started_at = created_at::date::text
WHERE started_at IS NULL
  AND (status IN ('in_progress', 'completed') OR completed = TRUE);

ALTER TABLE implementation_stages
  DROP CONSTRAINT IF EXISTS implementation_stages_planned_days_check;

ALTER TABLE implementation_stages
  ADD CONSTRAINT implementation_stages_planned_days_check
  CHECK (planned_days IS NULL OR planned_days >= 0);
