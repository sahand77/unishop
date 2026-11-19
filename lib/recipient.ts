import { z } from "zod";
import { digits } from "./contact";
import { provinces } from "./shared";

function textField(label: string, min: number, max: number) {
  return z.string({error: `${label} را وارد کنید.`}).trim()
    .min(1, `${label} را وارد کنید.`)
    .min(min, `${label} باید حداقل ${min.toLocaleString("fa-IR")} نویسه باشد.`)
    .max(max, `${label} باید حداکثر ${max.toLocaleString("fa-IR")} نویسه باشد.`);
}
export const customerSchema = z.object({
  name: textField("نام گیرنده", 2, 100),
  mobile: z.string().transform(digits).pipe(z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.")),
  province: z.enum(provinces, {error: "استان گیرنده را انتخاب کنید."}),
  city: textField("نام شهر", 2, 100),
  address: textField("نشانی کامل", 8, 500),
  postalCode: z.string().transform(digits).pipe(z.string().regex(/^\d{10}$/, "کد پستی باید دقیقاً ۱۰ رقم باشد.")),
});
export type Customer = z.infer<typeof customerSchema>;
