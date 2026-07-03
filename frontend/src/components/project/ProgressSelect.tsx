import { useState } from "react";
import { PROGRESS_OPTIONS, PROGRESS_LABELS } from "../../utils/constants";

interface ProgressSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProgressSelect({ value, onChange }: ProgressSelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="px-3 py-1 border border-border rounded text-sm bg-bg">
        {PROGRESS_LABELS[value as keyof typeof PROGRESS_LABELS] || value}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded shadow">
          {PROGRESS_OPTIONS.map((p) => (
            <div key={p} onClick={() => { onChange(p); setOpen(false); }} className="px-3 py-1 text-sm hover:bg-primary/10 cursor-pointer">
              {PROGRESS_LABELS[p]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
