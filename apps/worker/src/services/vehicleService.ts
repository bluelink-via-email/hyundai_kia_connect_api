import type { Env } from "../index";
import * as db from "../db/supabase";
import * as tokenCache from "../kv/tokenCache";
import { decrypt, encrypt } from "./encryptionService";

interface Token {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface Vehicle {
  id: string;
  nickname: string;
  brand: number;
  status: string;
  battery?: number;
  fuelLevel?: number;
  odometer?: number;
  locked?: boolean;
  charging?: boolean;
  temperature?: number;
}

interface CommandResponse {
  actionId: string;
  message: string;
}

export async function getOrLoginToken(
  vehicleAccount: db.VehicleAccount,
  env: Env
): Promise<Token> {
  // Check cache first
  const cached = await tokenCache.getCachedToken(vehicleAccount.id, env);
  if (cached) return cached;

  // Login and cache
  return loginAndCacheToken(vehicleAccount, env);
}

export async function loginAndCacheToken(
  vehicleAccount: db.VehicleAccount,
  env: Env
): Promise<Token> {
  // Decrypt credentials
  const username = vehicleAccount.username;
  const password = await decrypt(vehicleAccount.password_encrypted, env.ENCRYPTION_KEY);

  // Call vehicle API to login
  const token = await loginToVehicleAPI(username, password, vehicleAccount.brand, vehicleAccount.region);

  // Cache the token
  await tokenCache.setCachedToken(vehicleAccount.id, token, env);

  return token;
}

async function loginToVehicleAPI(
  username: string,
  password: string,
  brand: number,
  region: number
): Promise<Token> {
  // This would call the actual Hyundai/Kia API
  // For now, return a mock token
  // In production, use @hyundai-kia/api package
  return {
    accessToken: "mock_access_token",
    refreshToken: "mock_refresh_token",
    expiresIn: 3600,
    tokenType: "Bearer",
  };
}

export async function getVehicleStatus(
  vehicleAccountId: string,
  userId: string,
  env: Env
): Promise<Vehicle> {
  const vehicleAccount = await db.getVehicleAccount(vehicleAccountId, userId, env);
  if (!vehicleAccount) throw new Error("Vehicle account not found");

  const token = await getOrLoginToken(vehicleAccount, env);

  // Call vehicle API to get status
  const vehicle = await fetchVehicleStatusFromAPI(token, vehicleAccount.brand);

  return {
    id: vehicleAccount.id,
    nickname: vehicleAccount.nickname,
    brand: vehicleAccount.brand,
    ...vehicle,
  };
}

async function fetchVehicleStatusFromAPI(token: Token, brand: number): Promise<Partial<Vehicle>> {
  // Call actual vehicle API
  // Mock response for now
  return {
    status: "active",
    battery: 85,
    fuelLevel: 75,
    odometer: 15000,
    locked: true,
    charging: false,
    temperature: 72,
  };
}

export async function executeCommand(
  vehicleAccountId: string,
  userId: string,
  command: string,
  options: Record<string, unknown>,
  env: Env
): Promise<CommandResponse> {
  const vehicleAccount = await db.getVehicleAccount(vehicleAccountId, userId, env);
  if (!vehicleAccount) throw new Error("Vehicle account not found");

  const token = await getOrLoginToken(vehicleAccount, env);
  const pin = await decrypt(vehicleAccount.pin_encrypted, env.ENCRYPTION_KEY);

  // Execute command via vehicle API
  const result = await executeVehicleCommand(
    token,
    vehicleAccount.brand,
    command,
    options,
    pin
  );

  // Record in history
  await db.addCommandHistory(
    {
      user_id: userId,
      vehicle_account_id: vehicleAccountId,
      command: command,
      result: JSON.stringify(result),
    },
    env
  );

  return result;
}

async function executeVehicleCommand(
  token: Token,
  brand: number,
  command: string,
  options: Record<string, unknown>,
  pin: string
): Promise<CommandResponse> {
  // Call actual vehicle API with command
  // Mock response for now
  const actionId = `action_${Date.now()}`;

  let message = "";
  switch (command) {
    case "LOCK":
      message = "Vehicle locked successfully";
      break;
    case "UNLOCK":
      message = "Vehicle unlocked successfully";
      break;
    case "START":
      message = `Vehicle starting with options: ${JSON.stringify(options)}`;
      break;
    case "STOP":
      message = "Vehicle stopped";
      break;
    case "CHARGE_START":
      message = "Charging started";
      break;
    case "CHARGE_STOP":
      message = "Charging stopped";
      break;
    case "STATUS":
      message = "Status retrieved";
      break;
    default:
      message = `Command ${command} executed`;
  }

  return { actionId, message };
}
