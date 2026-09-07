CREATE TABLE IF NOT EXISTS nda_status_history (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER NOT NULL REFERENCES implementation_stages(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_id TEXT,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nda_status_history_stage_idx
  ON nda_status_history (stage_id, changed_at DESC);
