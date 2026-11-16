export type ProductMedia = { kind: "image" | "video"; url: string };

export const galleryLimit = 12;
export const imageLimit = 2 * 1024 * 1024;
export const videoLimit = 35 * 1024 * 1024;

export const mediaFormats = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", webm: "video/webm",
};
