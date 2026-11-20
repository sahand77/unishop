import { unstable_cache } from "next/cache";
import { cache } from "react";
import { db } from "./db";

export const defaultStoreName = "یونی‌شاپ";
export const storeNameTag = "store-name";

export async function readStoreName() {
  const { rows: [setting] } = await db().query<{ value: string }>(
    "SELECT value FROM store_settings WHERE key = 'store_name'",
  );
  return setting?.value ?? defaultStoreName;
}

export const storeName = cache(unstable_cache(readStoreName, [storeNameTag], { tags: [storeNameTag] }));

export async function saveStoreName(name: string) {
  await db().query(`
    INSERT INTO store_settings (key, value) VALUES ('store_name', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [name]);
}
