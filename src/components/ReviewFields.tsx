"use client";
import { useState } from "react";
import { COMMON_MISTAKES, GRADES } from "@/lib/constants";

/**
 * Grade / mistakes / lesson inputs shared by TradeForm (when closed) and CloseForm.
 * Renders plain named fields inside the parent <form>, so its FormData picks them up.
 */
export default function ReviewFields({
  allMistakes,
  defaultGrade,
  defaultLesson,
  initialMistakes,
}: {
  allMistakes: string[];
  defaultGrade?: string | null;
  defaultLesson?: string | null;
  initialMistakes?: string[];
}) {
  const [mistakes, setMistakes] = useState(
    (initialMistakes ?? []).join(", "),
  );
  const suggestions = [...new Set([...allMistakes, ...COMMON_MISTAKES])].sort();

  function addMistake(m: string) {
    const cur = mistakes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!cur.includes(m)) setMistakes([...cur, m].join(", "));
  }

  return (
    <>
      <div className="field full">
        <p className="panel-title" style={{ margin: "6px 0 0" }}>
          Review — grade the process, not the outcome
        </p>
      </div>

      <div className="field">
        <label>Execution grade</label>
        <select name="grade" defaultValue={defaultGrade ?? ""}>
          <option value="">— not graded —</option>
          {GRADES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <span className="hint">A good trade can lose; a bad trade can win.</span>
      </div>

      <div className="field">
        <label>Lesson — one line to remember</label>
        <input
          name="lesson"
          defaultValue={defaultLesson ?? ""}
          placeholder="e.g. wait for the retest before entering"
          autoComplete="off"
        />
      </div>

      <div className="field full">
        <label>Mistakes</label>
        <input
          name="mistakes"
          value={mistakes}
          onChange={(e) => setMistakes(e.target.value)}
          placeholder="comma separated — leave empty if clean"
          autoComplete="off"
        />
        <div style={{ marginTop: 6 }}>
          {suggestions.map((m) => (
            <button
              type="button"
              key={m}
              className="tag mistake"
              style={{ cursor: "pointer" }}
              onClick={() => addMistake(m)}
            >
              + {m}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
