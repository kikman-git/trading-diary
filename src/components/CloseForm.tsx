"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeTrade } from "@/app/actions";
import { toLocalInput } from "@/lib/format";
import ReviewFields from "./ReviewFields";
import ScreenshotDropzone, { type PreviewFile } from "./ScreenshotDropzone";

export default function CloseForm({
  tradeId,
  defaultFees,
  allMistakes,
}: {
  tradeId: number;
  defaultFees: number;
  allMistakes: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PreviewFile[]>([]);

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

  function submit() {
    if (!formRef.current) return;
    setError(null);
    const fd = new FormData(formRef.current);
    fd.set("tradeId", String(tradeId));
    files.forEach((f) => fd.append("screenshots", f.file));
    start(async () => {
      const res = await closeTrade(fd);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      ref={formRef}
    >
      <p className="panel-title">Close this trade</p>
      {error && <div className="error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label>Exit price *</label>
          <input name="exitPrice" type="number" step="any" required />
        </div>
        <div className="field">
          <label>Exit time</label>
          <input
            name="exitAt"
            type="datetime-local"
            defaultValue={toLocalInput(new Date())}
          />
        </div>
        <div className="field">
          <label>Fees</label>
          <input
            name="fees"
            type="number"
            step="any"
            defaultValue={defaultFees}
          />
        </div>
        <div className="field full">
          <label>Retrospective note (appended to notes)</label>
          <textarea
            name="addNotes"
            placeholder="How did it play out? Did you follow the plan?"
            style={{ minHeight: 80 }}
          />
        </div>
        <ReviewFields allMistakes={allMistakes} />
        <ScreenshotDropzone
          files={files}
          onAdd={addFiles}
          onRemove={removeFile}
          label="Add exit screenshots"
        />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Closing…" : "Close Trade"}
        </button>
      </div>
    </form>
  );
}
