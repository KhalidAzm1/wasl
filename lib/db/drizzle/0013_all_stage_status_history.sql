CREATE TABLE IF NOT EXISTS implementation_stage_status_history (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER NOT NULL REFERENCES implementation_stages(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_id TEXT,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS implementation_stage_status_history_stage_idx
  ON implementation_stage_status_history (stage_id, changed_at DESC);

INSERT INTO implementation_stage_status_history
  (stage_id, from_status, to_status, changed_by_id, changed_by_name, changed_at)
SELECT source.stage_id, source.from_status, source.to_status, source.changed_by_id, source.changed_by_name, source.changed_at
FROM nda_status_history source
WHERE NOT EXISTS (
  SELECT 1 FROM implementation_stage_status_history target
  WHERE target.stage_id = source.stage_id AND target.to_status = source.to_status AND target.changed_at = source.changed_at
);

INSERT INTO implementation_stage_status_history
  (stage_id, from_status, to_status, changed_by_id, changed_by_name, changed_at)
SELECT source.stage_id, source.from_status, source.to_status, source.changed_by_id, source.changed_by_name, source.changed_at
FROM agreement_status_history source
WHERE NOT EXISTS (
  SELECT 1 FROM implementation_stage_status_history target
  WHERE target.stage_id = source.stage_id AND target.to_status = source.to_status AND target.changed_at = source.changed_at
);

INSERT INTO implementation_stage_status_history
  (stage_id, from_status, to_status, changed_by_name)
SELECT id, 'blocked', 'on_hold', 'System migration'
FROM implementation_stages
WHERE status = 'blocked';

UPDATE implementation_stages
SET status = 'on_hold', updated_at = NOW()
WHERE status = 'blocked';

UPDATE implementation_sub_stages
SET status = 'on_hold'
WHERE status = 'blocked';
