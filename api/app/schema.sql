-- Demo schema. Field names follow the requirements' contracts (§3 event schema,
-- impression log, §4 item metadata, §9 recommendation output).

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Item metadata (§4). Full record in `data`; mutable eligibility fields lifted out.
CREATE TABLE IF NOT EXISTS items (
  item_id      text PRIMARY KEY,
  data         jsonb NOT NULL,
  status       text NOT NULL,
  expiry_date  date NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Pseudonymous HCP records. Analytics and training only ever see hcp_id.
CREATE TABLE IF NOT EXISTS hcps (
  hcp_id            text PRIMARY KEY,
  specialty         text NOT NULL,
  profession        text NOT NULL DEFAULT 'physician',
  country           text NOT NULL,
  language          text NOT NULL,
  verified          boolean NOT NULL,
  tracking_consent  boolean NOT NULL,
  crm_consent       boolean NOT NULL,
  synthetic         boolean NOT NULL DEFAULT false,
  persona           text,
  cluster_id        int,
  cluster_source    text,           -- seed | provisional | assigned
  map_x             double precision,
  map_y             double precision,
  demo_run          text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hcps_spec_country ON hcps (specialty, country);

-- The link to real identity lives apart from behaviour data (§3 event rules).
CREATE TABLE IF NOT EXISTS identities (
  hcp_id       text PRIMARY KEY REFERENCES hcps (hcp_id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  email        text,
  licence_no   text,
  oce_id       text
);

-- One event schema for every event (§3).
CREATE TABLE IF NOT EXISTS events (
  event_id    uuid PRIMARY KEY,
  hcp_id      text NOT NULL,
  item_id     text,
  event_type  text NOT NULL,
  value       text,                 -- seconds, % watched, scroll %, or query text
  session_id  text NOT NULL,
  device      text,
  country     text,
  language    text,
  ts          timestamptz NOT NULL,
  synthetic   boolean NOT NULL DEFAULT false,
  demo_run    text
);
CREATE INDEX IF NOT EXISTS events_hcp_ts ON events (hcp_id, ts DESC);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS events_session_item ON events (session_id, item_id);

-- Every recommendation impression (§3, §7 rule 10, §8 explainability).
CREATE TABLE IF NOT EXISTS impressions (
  impression_id       uuid PRIMARY KEY,
  request_id          uuid NOT NULL,
  hcp_id              text NOT NULL,
  session_id          text,
  item_id             text NOT NULL,
  slot                text NOT NULL,
  rank                int NOT NULL,
  score               double precision NOT NULL,
  level               text NOT NULL,
  reason_template     text NOT NULL,
  reason_params       jsonb NOT NULL DEFAULT '{}',
  signals             jsonb NOT NULL DEFAULT '{}',
  model_version       text NOT NULL,
  experiment_id       text,
  experiment_variant  text,
  ts                  timestamptz NOT NULL,
  synthetic           boolean NOT NULL DEFAULT false,
  demo_run            text
);
CREATE INDEX IF NOT EXISTS imp_hcp_ts ON impressions (hcp_id, ts DESC);
CREATE INDEX IF NOT EXISTS imp_session_item ON impressions (session_id, item_id);
CREATE INDEX IF NOT EXISTS imp_ts ON impressions (ts);

-- ProfileStore (stands in for Redis).
CREATE TABLE IF NOT EXISTS profiles (
  hcp_id      text PRIMARY KEY,
  profile     jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Level 3 output of the offline clustering run.
CREATE TABLE IF NOT EXISTS clusters (
  cluster_id   int PRIMARY KEY,
  label_en     text NOT NULL,
  label_ar     text NOT NULL,
  size         int NOT NULL,
  defining     jsonb NOT NULL,
  top_items    jsonb NOT NULL,
  top_tas      jsonb NOT NULL,
  centroid     jsonb NOT NULL,
  x            double precision,
  y            double precision,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pop_cluster (
  cluster_id  int NOT NULL,
  item_id     text NOT NULL,
  score       double precision NOT NULL,
  PRIMARY KEY (cluster_id, item_id)
);

CREATE TABLE IF NOT EXISTS pop_specialty (
  specialty  text NOT NULL,
  country    text NOT NULL,
  item_id    text NOT NULL,
  score      double precision NOT NULL,
  PRIMARY KEY (specialty, country, item_id)
);

-- CrmAdapter outbox (stands in for the OCE connector's queue, with retry state).
CREATE TABLE IF NOT EXISTS crm_outbox (
  id            bigserial PRIMARY KEY,
  hcp_id        text NOT NULL,
  kind          text NOT NULL,      -- engagement | recommendations | profile
  payload       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'queued',  -- queued | delivered | failed
  attempts      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  delivered_at  timestamptz,
  demo_run      text
);
CREATE INDEX IF NOT EXISTS crm_hcp ON crm_outbox (hcp_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_status ON crm_outbox (status);

-- Admin overrides (§4): pin / block per country and TA. Overrides beat the model.
CREATE TABLE IF NOT EXISTS overrides (
  id          serial PRIMARY KEY,
  action      text NOT NULL,        -- pin | block
  country     text NOT NULL,        -- country code or *
  ta          text,
  item_id     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  demo_run    text
);
