import type { Env } from "../index";

function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function hmacSha256(
  message: string,
  secret: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return new Uint8Array(signature);
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = getRandomBytes(16);
  const hash = await pbkdf2(password, salt);

  // Combine salt + hash and encode as base64
  const combined = new Uint8Array(salt.length + hash.length);
  combined.set(salt);
  combined.set(hash, salt.length);

  return Buffer.from(combined).toString("base64");
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const combined = Buffer.from(hash, "base64");
    const salt = combined.subarray(0, 16);
    const storedHash = combined.subarray(16);

    const computedHash = await pbkdf2(password, salt);

    // Constant-time comparison
    if (computedHash.length !== storedHash.length) return false;
    let equal = 0;
    for (let i = 0; i < computedHash.length; i++) {
      equal |= computedHash[i] ^ storedHash[i];
    }
    return equal === 0;
  } catch {
    return false;
  }
}

export async function createSession(
  userId: string,
  env: Env
): Promise<string> {
  const sessionId = Buffer.from(getRandomBytes(32)).toString("hex");
  const sessionData = {
    userId,
    createdAt: Date.now(),
  };

  // Store in KV with 30-day TTL
  await env.USER_SESSIONS.put(
    sessionId,
    JSON.stringify(sessionData),
    { expirationTtl: 30 * 24 * 60 * 60 }
  );

  return sessionId;
}

export async function getSession(
  sessionId: string,
  env: Env
): Promise<{ userId: string } | null> {
  try {
    const data = await env.USER_SESSIONS.get(sessionId);
    if (!data) return null;

    const sessionData = JSON.parse(data);
    return { userId: sessionData.userId };
  } catch {
    return null;
  }
}

export async function deleteSession(
  sessionId: string,
  env: Env
): Promise<void> {
  await env.USER_SESSIONS.delete(sessionId);
}
