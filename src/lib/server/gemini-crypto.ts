import "server-only";

import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;

function normalizeKeyMaterial(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Missing required environment variable: APP_ENCRYPTION_KEY");
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(normalized, "base64");

    if (buffer.length === KEY_BYTES) {
      return buffer;
    }
  }

  throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
}

function getEncryptionKey() {
  const rawKey = process.env.APP_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("Missing required environment variable: APP_ENCRYPTION_KEY");
  }

  const key = normalizeKeyMaterial(rawKey);

  if (key.length !== KEY_BYTES) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
  }

  return key;
}

export function encryptGeminiApiKey(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptGeminiApiKey(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(":");

  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted Gemini API key payload.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
