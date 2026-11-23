"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { GripVertical, ImagePlus, Trash2, Video, X } from "lucide-react";
import type { ProductMedia } from "@/lib/product-media";
import { fa } from "@/lib/shared";

export async function uploadMedia(file: File): Promise<ProductMedia> {
  const response = await fetch("/api/uploads",{
    method:"POST", headers:{ "Content-Type":"application/octet-stream" }, body:file,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "بارگذاری فایل انجام نشد.");
  return result;
}

export type ShowMediaPreview = (media: ProductMedia, label: string, onSelect?: () => void) => void;

export function MediaPreviewDialog({ media, label, onSelect, onClose }: {
  media: ProductMedia; label: string; onSelect?: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function close() {
    dialog.current?.close();
    onClose();
  }

  return <dialog ref={dialog} className="admin-media-dialog" aria-labelledby={title} onCancel={event => {
    event.preventDefault();
    close();
  }}>
    <div className="section-head">
      <h2 id={title}>{label}</h2>
      <button type="button" className="icon-link" aria-label="بستن پیش‌نمایش" onClick={close}><X size={20}/></button>
    </div>
    {media.kind === "video" ? <video src={media.url} controls playsInline preload="metadata" aria-label={label}/>
      : <img src={media.url} alt={label}/>}
    {onSelect && <button type="button" className="button primary" onClick={() => {
      onSelect();
      close();
    }}>انتخاب برای ترکیب</button>}
  </dialog>;
}

export function MediaEditor({ items,onChange,onBusy,onPreview }: {
  items: ProductMedia[]; onChange: (items: ProductMedia[]) => void; onBusy: (busy: boolean) => void;
  onPreview: ShowMediaPreview;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress,setProgress] = useState("");
  const [errors,setErrors] = useState<string[]>([]);
  const [draggedUrl,setDraggedUrl] = useState("");
  const [dropIndex,setDropIndex] = useState<number | null>(null);
  const draggedIndex = items.findIndex(item => item.url === draggedUrl);

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

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const reordered = [...items];
    const [item] = reordered.splice(from,1);
    reordered.splice(to,0,item);
    onChange(reordered);
  }

  function endDrag() {
    setDraggedUrl("");
    setDropIndex(null);
  }

  function insertionIndex(event: DragEvent<HTMLOListElement>) {
    const index = Array.from(event.currentTarget.children).findIndex(row => {
      const { top,height } = row.getBoundingClientRect();
      return event.clientY < top + height / 2;
    });
    return index === -1 ? items.length : index;
  }

  return <section className="flow" aria-labelledby="gallery-editor-title">
    <h2 id="gallery-editor-title">گالری عکس و ویدئو</h2>
    <p className="muted">فرمت‌های عکس JPEG، PNG و WebP و فرمت‌های ویدئو MP4 و WebM هستند.</p>
    {items.length > 0 && <ol className="media-editor-list"
      onDragOver={event => {
        if (draggedIndex === -1) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropIndex(insertionIndex(event));
      }}
      onDragLeave={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropIndex(null);
      }}
      onDrop={event => {
        if (draggedIndex === -1) return;
        event.preventDefault();
        const index = insertionIndex(event);
        move(draggedIndex,index > draggedIndex ? index - 1 : index);
        endDrag();
      }}>
    {items.map((item,index) => {
      const label = `${item.kind === "image" ? "عکس" : "ویدئو"} ${fa(index+1)}`;
      const showDrop = dropIndex !== draggedIndex && dropIndex !== draggedIndex + 1;
      const dropEdge = !showDrop ? undefined : dropIndex === index ? "before"
        : dropIndex === items.length && index === items.length - 1 ? "after" : undefined;
      return <li key={item.url} data-dragging={index === draggedIndex || undefined} data-drop-edge={dropEdge}>
        <button type="button" className="media-preview-trigger" aria-label={`پیش‌نمایش ${label}`} aria-haspopup="dialog"
          onClick={() => onPreview(item,label)}>
          {item.kind === "image" ? <img className="upload-preview" src={item.url} alt="" draggable={false}/>
            : <span className="upload-preview image-empty"><Video size={22}/></span>}
          <span>{label}</span>
        </button>
        <div className="media-editor-actions">
          <button className="icon-link danger" type="button" aria-label={`حذف فایل ${fa(index+1)}`}
            onClick={() => onChange(items.filter((entry) => entry.url !== item.url))}><Trash2 size={17}/></button>
          <button className="icon-link media-drag-handle" type="button" draggable={items.length > 1} disabled={items.length < 2}
            aria-label={`جابه‌جایی ${label}`} aria-keyshortcuts="ArrowUp ArrowDown" title="برای جابه‌جایی بکشید"
            onDragStart={event => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-unishop-media",item.url);
              const row = event.currentTarget.closest("li");
              if (row) {
                const { left,top } = row.getBoundingClientRect();
                event.dataTransfer.setDragImage(row,event.clientX - left,event.clientY - top);
              }
              setDraggedUrl(item.url);
            }} onDragEnd={endDrag}
            onKeyDown={event => {
              const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
              if (!offset) return;
              event.preventDefault();
              const handle = event.currentTarget;
              move(index,index + offset);
              requestAnimationFrame(() => handle.focus());
            }}><GripVertical size={20}/></button>
        </div>
      </li>;
    })}
    </ol>}
    <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,.mp4,.webm"
      onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void addFiles(files); }}/>
    <button type="button" className="button" disabled={!!progress} onClick={() => input.current?.click()}>
      <ImagePlus size={18}/> افزودن عکس و ویدئو
    </button>
    {progress && <p role="status">{progress}</p>}
    {errors.length > 0 && <ul className="notice error" role="alert">{errors.map((error,index) => <li key={index}>{error}</li>)}</ul>}
  </section>;
}
