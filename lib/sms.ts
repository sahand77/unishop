import { readCredential } from "./integration-settings";

export { digits, mobileNumber } from "./contact";

type Parameters = { name: string; value: string }[];

async function smsApiKey() {
  const apiKey = await readCredential("sms");
  if (!apiKey) throw new Error("کلید پیامک تنظیم نشده است.");
  return apiKey;
}

async function deliverTemplate(apiKey: string, mobile: string, templateId: number, parameters: Parameters) {
  const response = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ mobile, templateId, parameters }),
    signal: AbortSignal.timeout(10000), cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || result.status !== 1) throw new Error("ارسال پیامک انجام نشد.");
}

export async function sendTemplate(mobile: string, templateId: number, parameters: Parameters) {
  await deliverTemplate(await smsApiKey(), mobile, templateId, parameters);
}

export async function sendCode(mobile: string, code: string) {
  const templateId = Number(process.env.SMS_TEMPLATE_ID || 259263);
  if (!Number.isSafeInteger(templateId) || templateId <= 0) throw new Error("قالب پیامک تنظیم نشده است.");
  const parameter = process.env.SMS_CODE_PARAMETER || "CODE";
  const apiKey = await smsApiKey();
  try {
    await deliverTemplate(apiKey, mobile, templateId, [{ name: parameter, value: code }]);
  } catch {
    throw new Error("ارسال کد انجام نشد. کمی بعد دوباره تلاش کنید.");
  }
}
