"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type PreviewFile = { file: File; url: string };

export default function ScreenshotDropzone({
  files,
  onAdd,
  onRemove,
  label = "Screenshots",
}: {
  files: PreviewFile[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  label?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Paste anywhere on the page while this form is mounted.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const imgs: File[] = [];
      for (const it of e.clipboardData?.items ?? []) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length) {
        e.preventDefault();
        onAdd(imgs);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onAdd]);

  const pick = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (imgs.length) onAdd(imgs);
    },
    [onAdd],
  );

  return (
    <div className="field full">
      <label>{label}</label>
      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files);
        }}
      >
        Paste (<kbd>Ctrl/⌘ V</kbd>), drag &amp; drop, or click to choose
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="thumbs" style={{ marginTop: 10 }}>
          {files.map((f, i) => (
            <div
              className="thumb"
              key={i}
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" />
              <button
                type="button"
                className="del"
                onClick={() => onRemove(i)}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
