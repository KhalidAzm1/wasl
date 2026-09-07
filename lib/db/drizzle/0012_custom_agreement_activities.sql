ALTER TABLE implementation_stages
  ADD COLUMN IF NOT EXISTS activity_type TEXT NOT NULL DEFAULT 'standard';

UPDATE implementation_stages
SET activity_type = CASE
  WHEN LOWER(TRIM(name)) = 'nda' THEN 'nda'
  WHEN LOWER(TRIM(name)) = 'agreement' THEN 'commercial_agreement'
  ELSE activity_type
END
WHERE track_type = 'business';

ALTER TABLE implementation_stages
  DROP CONSTRAINT IF EXISTS implementation_stages_activity_type_check;

ALTER TABLE implementation_stages
  ADD CONSTRAINT implementation_stages_activity_type_check
  CHECK (activity_type IN ('standard', 'nda', 'commercial_agreement', 'custom_agreement'));
