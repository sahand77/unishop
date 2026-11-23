import { unstable_cache } from "next/cache";
import { cache } from "react";
import { z } from "zod";
import { digits } from "./contact";
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

export const storeFooterTag = "store-footer";

export function storePhoneHref(phone: string) {
  return `tel:${digits(phone).replaceAll(/[ ().-]/g, "")}`;
}

export const storeFooterSchema = z.object({
  address: z.string().trim().max(500, "آدرس فروشگاه باید حداکثر ۵۰۰ نویسه باشد."),
  phone: z.string().trim().max(40, "شمارهٔ تماس بیش از حد طولانی است.").refine(phone =>
    !phone || ( /^\+?[0-9۰-۹٠-٩ ().-]+$/.test(phone) && /^tel:\+?[0-9]{3,15}$/.test(storePhoneHref(phone)) ),
  "شمارهٔ تماس معتبر وارد کنید."),
  socialLinks: z.array(z.object({
    name: z.string().trim().min(1, "نام شبکهٔ اجتماعی را وارد کنید.").max(60, "نام شبکهٔ اجتماعی باید حداکثر ۶۰ نویسه باشد."),
    url: z.string().trim().max(2048).refine(value => {
      const url = /^https?:\/\//i.test(value) ? URL.parse(value) : null;
      return url && !url.username && !url.password;
    }, "لینک شبکهٔ اجتماعی باید یک آدرس معتبر با http یا https باشد."),
    logo: z.string().regex(/^(?:\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp))?$/, "لوگوی شبکهٔ اجتماعی معتبر نیست."),
  })).max(12, "حداکثر ۱۲ شبکهٔ اجتماعی می‌توانید اضافه کنید."),
});

export type StoreFooterSettings = z.infer<typeof storeFooterSchema>;

async function readStoreFooter(): Promise<StoreFooterSettings> {
  const { rows: [setting] } = await db().query<{ value: string }>(
    "SELECT value FROM store_settings WHERE key = 'store_footer'",
  );
  return setting ? storeFooterSchema.parse(JSON.parse(setting.value)) : { address: "", phone: "", socialLinks: [] };
}

export const storeFooter = cache(unstable_cache(readStoreFooter, [storeFooterTag], { tags: [storeFooterTag] }));

export async function saveStoreFooter(footer: StoreFooterSettings) {
  await db().query(`
    INSERT INTO store_settings (key, value) VALUES ('store_footer', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [JSON.stringify(footer)]);
}

export const storeEnamadTag = "store-enamad";

async function readStoreEnamad() {
  const { rows: [setting] } = await db().query<{ value: string }>(
    "SELECT value FROM store_settings WHERE key = 'store_enamad'",
  );
  return setting?.value ?? "";
}

export const storeEnamad = cache(unstable_cache(readStoreEnamad, [storeEnamadTag], { tags: [storeEnamadTag] }));

export async function saveStoreEnamad(embed: string) {
  await db().query(`
    INSERT INTO store_settings (key, value) VALUES ('store_enamad', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [embed]);
}
