-- Aegis-402 runtime persistence tables (applied locally 2026-11-01).
-- Re-apply before deploy: npx wrangler d1 execute aegis-db --remote --file ./store-tables.sql
CREATE TABLE IF NOT EXISTS bounty_records (
  id text PRIMARY KEY,
  status text NOT NULL,
  creator_id text,
  payload text NOT NULL,
  updated_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS bounty_records_status_idx ON bounty_records (status);
CREATE TABLE IF NOT EXISTS agent_key_records (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  payload text NOT NULL,
  updated_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_key_records_owner_idx ON agent_key_records (owner_user_id);
CREATE INDEX IF NOT EXISTS agent_key_records_hash_idx ON agent_key_records (key_hash);
-- NOTE: no artifact blob table. Code bytes live on the arbiter; the hub stores
-- only sha256 hashes. Buyer downloads go browser → arbiter via signed URLs.
