"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addScreenshots, deleteScreenshot } from "@/app/actions";
import ScreenshotDropzone, { type PreviewFile } from "./ScreenshotDropzone";

type Shot = { id: number; filePath: string; thumbPath: string };

export default function ScreenshotGallery({
  tradeId,
  shots,
}: {
  tradeId: number;
  shots: Shot[];
}) {
  const router = useRouter();
  const [zoom, setZoom] = useState<string | null>(null);
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [pending, start] = useTransition();

  function addFiles(list: File[]) {
    setFiles((p) => [
      ...p,
      ...list.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }
  function removeFile(i: number) {
    setFiles((p) => {
      URL.revokeObjectURL(p[i].url);
      return p.filter((_, idx) => idx !== i);
    });
  }
  function upload() {
    if (!files.length) return;
    const fd = new FormData();
    fd.set("tradeId", String(tradeId));
    files.forEach((f) => fd.append("screenshots", f.file));
    start(async () => {
      const res = await addScreenshots(fd);
      if (res.ok) {
        files.forEach((f) => URL.revokeObjectURL(f.url));
        setFiles([]);
        router.refresh();
      }
    });
  }
  function del(id: number) {
    const fd = new FormData();
    fd.set("screenshotId", String(id));
    start(async () => {
      await deleteScreenshot(fd);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="thumbs">
        {shots.map((s) => (
          <div className="thumb" key={s.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/img/${s.thumbPath}`}
              alt=""
              onClick={() => setZoom(`/api/img/${s.filePath}`)}
            />
            <button
              className="del"
              onClick={() => del(s.id)}
              title="Delete"
              disabled={pending}
            >
              ×
            </button>
          </div>
        ))}
        {shots.length === 0 && <span className="muted">No screenshots.</span>}
      </div>

      <div style={{ marginTop: 12 }}>
        <ScreenshotDropzone
          files={files}
          onAdd={addFiles}
          onRemove={removeFile}
          label="Add screenshots"
        />
        {files.length > 0 && (
          <button
            className="btn sm primary"
            onClick={upload}
            disabled={pending}
            style={{ marginTop: 8 }}
          >
            {pending ? "Uploading…" : `Upload ${files.length}`}
          </button>
        )}
      </div>

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" />
        </div>
      )}
    </div>
  );
}
