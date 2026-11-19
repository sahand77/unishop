export function digits(value: string) {
  return value.replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632));
}

export function mobileNumber(value: string) {
  const mobile = digits(value);
  if (!/^09\d{9}$/.test(mobile)) throw new Error("شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.");
  return mobile;
}
