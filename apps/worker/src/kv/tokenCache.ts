import type { Env } from "../index";

interface Token {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export async function getCachedToken(
  vehicleAccountId: string,
  env: Env
): Promise<Token | null> {
  try {
    const key = `token:${vehicleAccountId}`;
    const data = await env.VEHICLE_TOKENS.get(key);
    if (!data) return null;

    return JSON.parse(data) as Token;
  } catch {
    return null;
  }
}

export async function setCachedToken(
  vehicleAccountId: string,
  token: Token,
  env: Env
): Promise<void> {
  const key = `token:${vehicleAccountId}`;
  // 23 hour TTL
  await env.VEHICLE_TOKENS.put(key, JSON.stringify(token), {
    expirationTtl: 23 * 60 * 60,
  });
}

export async function deleteCachedToken(
  vehicleAccountId: string,
  env: Env
): Promise<void> {
  const key = `token:${vehicleAccountId}`;
  await env.VEHICLE_TOKENS.delete(key);
}

export type { Token };
