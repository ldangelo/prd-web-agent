/**
 * Encryption utilities for storing API keys at rest.
 *
 * Uses AES-256-GCM via Node.js built-in crypto module.
 * Encrypted values are stored as "iv:authTag:ciphertext" in hex.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.LLM_KEY_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing encryption key: set LLM_KEY_ENCRYPTION_SECRET or AUTH_SECRET",
    );
  }
  // Derive a 32-byte key by hashing the secret
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext API key.
 *
 * @returns Encrypted string in format "iv:authTag:ciphertext" (hex-encoded)
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an encrypted API key.
 *
 * @param encrypted - String in format "iv:authTag:ciphertext" (hex-encoded)
 * @returns The original plaintext API key
 */
export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
