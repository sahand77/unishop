export function publicUrl(path: string) {
  return new URL(path, process.env.APP_URL || "http://127.0.0.1:3000").href;
}
