import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./db";
import { dataDir } from "./uploads";

export type Integration = "zarinpal" | "sms";
export type CredentialSource = "panel" | "environment" | "missing";

function environmentCredential(integration: Integration) {
  return integration === "zarinpal" ? process.env.ZARINPAL_MERCHANT_ID : process.env.SMS_API_KEY;
}

async function smsEncryptionKey(create = false): Promise<Buffer> {
  const directory = dataDir();
  const path = join(directory, "sms-encryption.key");
  try {
    return await readFile(path);
  } catch (error) {
    if (!create || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(directory, { recursive: true });
  const temporary = `${path}.${randomUUID()}`;
  const key = randomBytes(32);
  await writeFile(temporary, key, { flag: "wx", mode: 0o600 });
  try {
    // Publish the complete key atomically, even if two processes save at once.
    await link(temporary, path);
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return await readFile(path);
  } finally {
    await unlink(temporary);
  }
}

async function storedCredential(integration: Integration) {
  const { rows: [setting] } = await db().query<{ value: string }>(
    "SELECT value FROM store_settings WHERE key = $1", [`integration_${integration}`],
  );
  return setting?.value;
}

export async function credentialSource(integration: Integration): Promise<CredentialSource> {
  if (await storedCredential(integration)) return "panel";
  return environmentCredential(integration) ? "environment" : "missing";
}

export async function readCredential(integration: Integration) {
  const stored = await storedCredential(integration);
  if (!stored) return environmentCredential(integration);
  if (integration === "zarinpal") return stored;

  const [iv, tag, ciphertext] = stored.split(".").map(part => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", await smsEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export async function saveCredential(integration: Integration, credential: string) {
  let value = credential;
  if (integration === "sms") {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", await smsEncryptionKey(true), iv);
    const ciphertext = Buffer.concat([cipher.update(credential, "utf8"), cipher.final()]);
    value = [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".");
  }

  await db().query(`
    INSERT INTO store_settings (key, value) VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [`integration_${integration}`, value]);
}
