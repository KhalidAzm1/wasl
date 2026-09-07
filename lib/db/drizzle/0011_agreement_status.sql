CREATE TABLE IF NOT EXISTS agreement_status_history (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER NOT NULL REFERENCES implementation_stages(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_id TEXT,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agreement_status_history_stage_idx
  ON agreement_status_history (stage_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS agreement_comments (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER NOT NULL REFERENCES implementation_stages(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agreement_comments_stage_idx
  ON agreement_comments (stage_id, created_at DESC);
