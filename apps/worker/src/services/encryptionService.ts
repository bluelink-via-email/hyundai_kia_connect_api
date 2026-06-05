import type { Env } from "../index";

function getKeyFromHex(keyHex: string): CryptoKey {
  const keyBuffer = Buffer.from(keyHex, "hex");
  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  ) as Promise<CryptoKey> as any;
}

async function getEncryptionKey(keyHex: string): Promise<CryptoKey> {
  const keyBuffer = Buffer.from(keyHex, "hex");
  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(
  plaintext: string,
  keyHex: string
): Promise<string> {
  const key = await getEncryptionKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return Buffer.from(combined).toString("base64");
}

export async function decrypt(
  ciphertext: string,
  keyHex: string
): Promise<string> {
  const key = await getEncryptionKey(keyHex);
  const combined = Buffer.from(ciphertext, "base64");

  // Extract IV and ciphertext
  const iv = combined.subarray(0, 12);
  const encrypted = combined.subarray(12);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encrypted
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}
