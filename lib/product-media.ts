export type ProductMedia = { kind: "image" | "video"; url: string };

export const mediaFormats = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", webm: "video/webm",
};

export function basalamMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  const url = URL.parse(value);
  return url?.protocol === "https:" && url.hostname.endsWith(".basalam.com") && !url.username && !url.password && !url.port;
}
