export { digits, mobileNumber } from "./contact";

export function smsConfig() {
  const apiKey = process.env.SMS_API_KEY;
  const templateId = Number(process.env.SMS_TEMPLATE_ID || 123456);
  if (!apiKey || !Number.isSafeInteger(templateId) || templateId <= 0) throw new Error("کلید یا قالب پیامک تنظیم نشده است.");
  return { apiKey, templateId, parameter: process.env.SMS_CODE_PARAMETER || "Code" };
}

export async function sendCode(mobile: string, code: string) {
  const config = smsConfig();
  try {
    const response = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": config.apiKey },
      body: JSON.stringify({ mobile, templateId: config.templateId, parameters: [{ name: config.parameter, value: code }] }),
      signal: AbortSignal.timeout(10000), cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || result.status !== 1) throw new Error("provider failure");
  } catch {
    throw new Error("ارسال کد انجام نشد. کمی بعد دوباره تلاش کنید.");
  }
}
