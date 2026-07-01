
//src/lib/share-links.ts
import crypto from "crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // base62

function getKey() {
  const secret = process.env.SHARE_LINK_SECRET;
  if (!secret) throw new Error("Missing SHARE_LINK_SECRET");

  // Derivamos key 32 bytes
  return crypto.createHash("sha256").update(secret).digest(); // 32 bytes
}

export function generateShortCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// AES-256-GCM: devuelve base64url( iv | tag | ciphertext )
export function encryptCode(code: string) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptCode(codeEnc: string) {
  const key = getKey();
  const raw = Buffer.from(codeEnc, "base64url");

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
