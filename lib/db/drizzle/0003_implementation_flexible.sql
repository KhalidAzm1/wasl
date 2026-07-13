-- Implementation stages: fully configurable per bank
CREATE TABLE IF NOT EXISTS implementation_stages (
  id            SERIAL PRIMARY KEY,
  bank_id       TEXT NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  percentage    NUMERIC(5,2),
  status        TEXT NOT NULL DEFAULT 'not_started',
  skipped       BOOLEAN NOT NULL DEFAULT FALSE,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TEXT,
  owner         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sub-stages nested under a stage
CREATE TABLE IF NOT EXISTS implementation_sub_stages (
  id            SERIAL PRIMARY KEY,
  stage_id      INTEGER NOT NULL REFERENCES implementation_stages(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'not_started',
  skipped       BOOLEAN NOT NULL DEFAULT FALSE,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TEXT,
  owner         TEXT,
  notes         TEXT
);

-- Global settings (percentage_mode, default_stages template)
CREATE TABLE IF NOT EXISTS implementation_settings (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO implementation_settings (key, value) VALUES
  ('percentage_mode', 'dynamic'),
  ('default_stages', '["Initial Engagement","Business Analysis","Technical Development","Integration Testing (STG)","User Acceptance Testing (UAT)","Penetration Testing & Vulnerability Assessment (PT-AV)","Go-Live Preparation","Production Go-Live"]')
ON CONFLICT (key) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS is_bank_id_idx        ON implementation_stages (bank_id);
CREATE INDEX IF NOT EXISTS is_bank_order_idx     ON implementation_stages (bank_id, display_order);
CREATE INDEX IF NOT EXISTS iss_stage_id_idx      ON implementation_sub_stages (stage_id);
