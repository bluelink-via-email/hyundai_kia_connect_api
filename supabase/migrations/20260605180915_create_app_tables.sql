-- Users table (app accounts, separate from Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users FOR SELECT
  TO authenticated USING (auth.uid()::text = id::text);
CREATE POLICY "users_insert_own" ON users FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "users_update_own" ON users FOR UPDATE
  TO authenticated USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "users_delete_own" ON users FOR DELETE
  TO authenticated USING (auth.uid()::text = id::text);

-- Service role bypass (worker uses service role key)
CREATE POLICY "users_service_select" ON users FOR SELECT TO service_role USING (true);
CREATE POLICY "users_service_insert" ON users FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "users_service_update" ON users FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "users_service_delete" ON users FOR DELETE TO service_role USING (true);

-- Vehicle accounts
CREATE TABLE IF NOT EXISTS vehicle_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand integer NOT NULL,
  region integer NOT NULL,
  username text NOT NULL,
  password_encrypted text NOT NULL,
  pin_encrypted text,
  nickname text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_accounts_service_select" ON vehicle_accounts FOR SELECT TO service_role USING (true);
CREATE POLICY "vehicle_accounts_service_insert" ON vehicle_accounts FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "vehicle_accounts_service_update" ON vehicle_accounts FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "vehicle_accounts_service_delete" ON vehicle_accounts FOR DELETE TO service_role USING (true);

-- Command history
CREATE TABLE IF NOT EXISTS command_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_account_id uuid REFERENCES vehicle_accounts(id) ON DELETE SET NULL,
  command text NOT NULL,
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS command_history_user_id_idx ON command_history(user_id);
CREATE INDEX IF NOT EXISTS command_history_created_at_idx ON command_history(created_at DESC);

ALTER TABLE command_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "command_history_service_select" ON command_history FOR SELECT TO service_role USING (true);
CREATE POLICY "command_history_service_insert" ON command_history FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "command_history_service_update" ON command_history FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "command_history_service_delete" ON command_history FOR DELETE TO service_role USING (true);

-- Custom commands (user-defined aliases)
CREATE TABLE IF NOT EXISTS custom_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias text NOT NULL,
  command_json text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, alias)
);

ALTER TABLE custom_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_commands_service_select" ON custom_commands FOR SELECT TO service_role USING (true);
CREATE POLICY "custom_commands_service_insert" ON custom_commands FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "custom_commands_service_update" ON custom_commands FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "custom_commands_service_delete" ON custom_commands FOR DELETE TO service_role USING (true);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_temp_f integer NOT NULL DEFAULT 70,
  default_duration integer NOT NULL DEFAULT 10,
  defrost_default boolean NOT NULL DEFAULT false
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_service_select" ON user_settings FOR SELECT TO service_role USING (true);
CREATE POLICY "user_settings_service_insert" ON user_settings FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "user_settings_service_update" ON user_settings FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_settings_service_delete" ON user_settings FOR DELETE TO service_role USING (true);
