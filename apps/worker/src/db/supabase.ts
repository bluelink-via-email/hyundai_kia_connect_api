import { createClient } from "@supabase/supabase-js";
import type { Env } from "../index";

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface VehicleAccount {
  id: string;
  user_id: string;
  brand: number;
  region: number;
  username: string;
  password_encrypted: string;
  pin_encrypted: string;
  nickname: string;
  is_default: boolean;
}

interface CommandHistoryEntry {
  id: string;
  user_id: string;
  vehicle_account_id: string;
  command: string;
  result: string;
  created_at: string;
}

interface CustomCommand {
  id: string;
  user_id: string;
  alias: string;
  command_json: string;
}

interface UserSettings {
  user_id: string;
  default_temp_f: number;
  default_duration: number;
  defrost_default: boolean;
}

function getSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getUserByEmail(
  email: string,
  env: Env
): Promise<User | null> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) return null;
  return data as User;
}

export async function createUser(email: string, env: Env): Promise<User> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("users")
    .insert({ email })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as User;
}

export async function getUserById(id: string, env: Env): Promise<User | null> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as User;
}

export async function getVehicleAccounts(
  userId: string,
  env: Env
): Promise<VehicleAccount[]> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("vehicle_accounts")
    .select("*")
    .eq("user_id", userId);

  if (error) return [];
  return (data as VehicleAccount[]) || [];
}

export async function getVehicleAccount(
  id: string,
  userId: string,
  env: Env
): Promise<VehicleAccount | null> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("vehicle_accounts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data as VehicleAccount;
}

export async function createVehicleAccount(
  data: Omit<VehicleAccount, "id" | "created_at">,
  env: Env
): Promise<VehicleAccount> {
  const client = getSupabaseClient(env);
  const { data: result, error } = await client
    .from("vehicle_accounts")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Failed to create vehicle account: ${error.message}`);
  return result as VehicleAccount;
}

export async function updateVehicleAccount(
  id: string,
  userId: string,
  updates: Partial<VehicleAccount>,
  env: Env
): Promise<VehicleAccount> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("vehicle_accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error)
    throw new Error(`Failed to update vehicle account: ${error.message}`);
  return data as VehicleAccount;
}

export async function deleteVehicleAccount(
  id: string,
  userId: string,
  env: Env
): Promise<void> {
  const client = getSupabaseClient(env);
  const { error } = await client
    .from("vehicle_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete vehicle account: ${error.message}`);
}

export async function setDefaultVehicle(
  vehicleAccountId: string,
  userId: string,
  env: Env
): Promise<void> {
  const client = getSupabaseClient(env);

  // First, unset all other defaults for this user
  await client
    .from("vehicle_accounts")
    .update({ is_default: false })
    .eq("user_id", userId);

  // Then set the new default
  const { error } = await client
    .from("vehicle_accounts")
    .update({ is_default: true })
    .eq("id", vehicleAccountId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to set default vehicle: ${error.message}`);
}

export async function addCommandHistory(
  data: Omit<CommandHistoryEntry, "id" | "created_at">,
  env: Env
): Promise<CommandHistoryEntry> {
  const client = getSupabaseClient(env);
  const { data: result, error } = await client
    .from("command_history")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Failed to add command history: ${error.message}`);
  return result as CommandHistoryEntry;
}

export async function getCommandHistory(
  userId: string,
  limit: number = 50,
  env?: Env
): Promise<CommandHistoryEntry[]> {
  if (!env) throw new Error("env is required");
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("command_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data as CommandHistoryEntry[]) || [];
}

export async function getCustomCommands(
  userId: string,
  env: Env
): Promise<CustomCommand[]> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("custom_commands")
    .select("*")
    .eq("user_id", userId);

  if (error) return [];
  return (data as CustomCommand[]) || [];
}

export async function createCustomCommand(
  userId: string,
  alias: string,
  commandJson: string,
  env: Env
): Promise<CustomCommand> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("custom_commands")
    .insert({ user_id: userId, alias, command_json: commandJson })
    .select()
    .single();

  if (error) throw new Error(`Failed to create custom command: ${error.message}`);
  return data as CustomCommand;
}

export async function deleteCustomCommand(
  id: string,
  userId: string,
  env: Env
): Promise<void> {
  const client = getSupabaseClient(env);
  const { error } = await client
    .from("custom_commands")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete custom command: ${error.message}`);
}

export async function getUserSettings(
  userId: string,
  env: Env
): Promise<UserSettings | null> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data as UserSettings;
}

export async function upsertUserSettings(
  userId: string,
  settings: Partial<UserSettings>,
  env: Env
): Promise<UserSettings> {
  const client = getSupabaseClient(env);
  const { data, error } = await client
    .from("user_settings")
    .upsert({ user_id: userId, ...settings })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert user settings: ${error.message}`);
  return data as UserSettings;
}

export type { User, VehicleAccount, CommandHistoryEntry, CustomCommand, UserSettings };
