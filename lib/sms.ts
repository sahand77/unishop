export { digits, mobileNumber } from "./contact";

export function smsConfig() {
  const apiKey = process.env.SMS_API_KEY;
  const templateId = Number(process.env.SMS_TEMPLATE_ID || 259263);
  if (!apiKey || !Number.isSafeInteger(templateId) || templateId <= 0) throw new Error("کلید یا قالب پیامک تنظیم نشده است.");
  return { apiKey, templateId, parameter: process.env.SMS_CODE_PARAMETER || "CODE" };
}

export async function sendTemplate(mobile: string, templateId: number, parameters: { name: string; value: string }[]) {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) throw new Error("کلید پیامک تنظیم نشده است.");
  const response = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ mobile, templateId, parameters }),
    signal: AbortSignal.timeout(10000), cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || result.status !== 1) throw new Error("ارسال پیامک انجام نشد.");
}

export async function sendCode(mobile: string, code: string) {
  const { templateId, parameter } = smsConfig();
  try {
    await sendTemplate(mobile, templateId, [{ name: parameter, value: code }]);
  } catch {
    throw new Error("ارسال کد انجام نشد. کمی بعد دوباره تلاش کنید.");
  }
}
