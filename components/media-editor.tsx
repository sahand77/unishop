"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Trash2, Video } from "lucide-react";
import type { ProductMedia } from "@/lib/product-media";
import { fa } from "@/lib/shared";
import { ProductImage } from "./store-interactions";

export async function uploadMedia(file: File): Promise<ProductMedia> {
  const response = await fetch("/api/uploads",{
    method:"POST", headers:{ "Content-Type":"application/octet-stream" }, body:file,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "بارگذاری فایل انجام نشد.");
  return result;
}

export function MediaEditor({ items,onChange,onBusy }: {
  items: ProductMedia[]; onChange: (items: ProductMedia[]) => void; onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress,setProgress] = useState("");
  const [errors,setErrors] = useState<string[]>([]);
  async function addFiles(files: File[]) {
    setErrors([]);
    if (!files.length) return;
    const added: ProductMedia[] = [];
    const failures: string[] = [];
    onBusy(true);
    try {
      for (const [index,file] of files.entries()) {
        setProgress(`بارگذاری ${fa(index+1)} از ${fa(files.length)}`);
        try {
          added.push(await uploadMedia(file));
        } catch (error) {
          failures.push(`${file.name} · ${error instanceof Error ? error.message : "بارگذاری انجام نشد."}`);
        }
      }
      onChange([...items,...added]);
      setErrors(failures);
    } finally {
      onBusy(false);
      setProgress("");
      if (input.current) input.current.value = "";
    }
  }

  function move(index: number, offset: number) {
    const reordered = [...items];
    [reordered[index],reordered[index+offset]] = [reordered[index+offset],reordered[index]];
    onChange(reordered);
  }

  return <section className="flow" aria-labelledby="gallery-editor-title">
    <h2 id="gallery-editor-title">گالری عکس و ویدئو</h2>
    <p className="muted">فرمت‌های عکس JPEG، PNG و WebP و فرمت‌های ویدئو MP4 و WebM هستند.</p>
    {items.length > 0 && <ol className="media-editor-list">{items.map((item,index) =>
      <li key={item.url}>
        {item.kind === "image" ? <ProductImage className="upload-preview" src={item.url} title=""/>
          : <span className="upload-preview image-empty"><Video size={22}/></span>}
        <span>{item.kind === "image" ? "عکس" : "ویدئو"} {fa(index+1)}</span>
        <div className="media-editor-actions">
          <button className="icon-link" type="button" aria-label={`انتقال فایل ${fa(index+1)} به بالا`} disabled={index === 0}
            onClick={() => move(index,-1)}><ChevronUp size={18}/></button>
          <button className="icon-link" type="button" aria-label={`انتقال فایل ${fa(index+1)} به پایین`} disabled={index === items.length-1}
            onClick={() => move(index,1)}><ChevronDown size={18}/></button>
          <button className="icon-link danger" type="button" aria-label={`حذف فایل ${fa(index+1)}`}
            onClick={() => onChange(items.filter((entry) => entry.url !== item.url))}><Trash2 size={17}/></button>
        </div>
      </li>)}</ol>}
    <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,.mp4,.webm"
      onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void addFiles(files); }}/>
    <button type="button" className="button" disabled={!!progress} onClick={() => input.current?.click()}>
      <ImagePlus size={18}/> افزودن عکس و ویدئو
    </button>
    {progress && <p role="status">{progress}</p>}
    {errors.length > 0 && <ul className="notice error" role="alert">{errors.map((error,index) => <li key={index}>{error}</li>)}</ul>}
  </section>;
}
