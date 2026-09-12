-- 000_init.sql — target PostgreSQL schema (03_ARCH §5 database principles).
-- The MVP prototype runs on the in-memory store; this migration defines the
-- durable replacement. Run with your migration tool of choice. Every
-- user-scoped table carries explicit user ownership for RLS:
--   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation ON <table>
--     USING (user_id = auth.uid());  -- Supabase-style
-- RLS is a required authorization layer, plus server-side checks (defense in depth).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Locale/currency are user configuration, never product defaults (00_HANDOFF §2A).
CREATE TABLE profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  currency      CHAR(3) NOT NULL,
  country_code  CHAR(2) NOT NULL,
  language      TEXT NOT NULL,
  timezone      TEXT NOT NULL,
  week_start    SMALLINT NOT NULL DEFAULT 1 CHECK (week_start IN (0, 1)),
  preferences   JSONB NOT NULL DEFAULT '{}',      -- savings style, buffer policy, values
  emergency_current_minor BIGINT NOT NULL DEFAULT 0,
  emergency_target_minor  BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE income_sources (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  expected_amount_minor BIGINT NOT NULL CHECK (expected_amount_minor >= 0),
  currency              CHAR(3) NOT NULL,
  frequency             TEXT NOT NULL CHECK (frequency IN ('monthly','biweekly','weekly')),
  payday_rule           JSONB NOT NULL,
  reliability           TEXT NOT NULL CHECK (reliability IN ('stable','variable'))
);
CREATE INDEX idx_income_user ON income_sources (user_id);

CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('essential','flexible','goal_linked')),
  baseline_weight NUMERIC NOT NULL DEFAULT 1 CHECK (baseline_weight > 0),
  floor_minor     BIGINT,
  disabled        BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_categories_user ON categories (user_id);

CREATE TABLE recurring_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  essential             BOOLEAN NOT NULL DEFAULT FALSE,
  expected_amount_minor BIGINT NOT NULL CHECK (expected_amount_minor >= 0),
  range_low_minor       BIGINT,
  range_high_minor      BIGINT,
  cadence               TEXT NOT NULL CHECK (cadence IN ('monthly','weekly','annual')),
  due_day               SMALLINT,
  category_id           UUID REFERENCES categories(id) ON DELETE SET NULL,
  confidence            NUMERIC NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  source                TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','inferred'))
);
CREATE INDEX idx_recurring_user ON recurring_items (user_id);

-- Money: integer minor units only; original currency preserved per transaction.
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor      BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL,
  date              DATE NOT NULL,
  tx_timezone       TEXT NOT NULL,
  merchant          TEXT NOT NULL,
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  source            TEXT NOT NULL CHECK (source IN ('manual','text','voice','import','receipt')),
  confidence        NUMERIC NOT NULL DEFAULT 1,
  recurring_flag    BOOLEAN,
  import_idempotency_key TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user_date ON transactions (user_id, date DESC);
CREATE INDEX idx_tx_category_date ON transactions (category_id, date);
CREATE UNIQUE INDEX idx_tx_import_dedupe ON transactions (user_id, import_idempotency_key)
  WHERE import_idempotency_key IS NOT NULL;

-- Plans are versioned; approval is an explicit state machine, not a boolean.
CREATE TABLE month_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_year         SMALLINT NOT NULL,
  period_month        SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  currency            CHAR(3) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  allocations         JSONB NOT NULL,
  totals              JSONB NOT NULL,
  warnings            JSONB NOT NULL DEFAULT '[]',
  inputs_hash         TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at         TIMESTAMPTZ,
  UNIQUE (user_id, period_year, period_month, created_at)
);
CREATE INDEX idx_plans_user_period ON month_plans (user_id, period_year, period_month);

CREATE TABLE goals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  target_amount_minor       BIGINT NOT NULL CHECK (target_amount_minor > 0),
  saved_amount_minor        BIGINT NOT NULL DEFAULT 0 CHECK (saved_amount_minor >= 0),
  currency                  CHAR(3) NOT NULL,
  target_date               DATE,
  priority                  SMALLINT NOT NULL DEFAULT 3,
  min_monthly_contrib_minor BIGINT,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','achieved'))
);
CREATE INDEX idx_goals_user_status ON goals (user_id, status);

-- Trial/subscription state is server-authoritative and separate from the ledger.
CREATE TABLE subscriptions (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL,
  plan_id            TEXT NOT NULL,
  trial_start_at     TIMESTAMPTZ NOT NULL,
  trial_end_at       TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('trialing','active','expired')),
  renewal_at         TIMESTAMPTZ,
  cancel_at          TIMESTAMPTZ,
  provider_reference TEXT
);

CREATE TABLE entitlements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key  TEXT NOT NULL,
  source       TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  UNIQUE (user_id, feature_key)
);

-- Jurisdiction-gated capabilities (00_HANDOFF §2A.6): enabled per country after review.
CREATE TABLE country_capabilities (
  country_code      CHAR(2) NOT NULL,
  feature_key       TEXT NOT NULL,
  availability      BOOLEAN NOT NULL DEFAULT FALSE,
  compliance_status TEXT NOT NULL DEFAULT 'unreviewed',
  rollout_state     TEXT NOT NULL DEFAULT 'off',
  PRIMARY KEY (country_code, feature_key)
);

CREATE TABLE audit_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  details    JSONB NOT NULL DEFAULT '{}',
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user ON audit_events (user_id, at DESC);
