import { Fragment } from "react";
import type { EvidenceLabel } from "@/types/oauth";

const STYLE: Record<EvidenceLabel, string> = {
  "Live Verified": "border-sky-500/30 bg-sky-500/10 text-sky-300",
  "Doc Supported": "border-zinc-600/50 bg-zinc-800/60 text-zinc-300",
  Uncertain: "border-dashed border-amber-500/40 bg-transparent text-amber-300/90",
};

const HINT: Record<EvidenceLabel, string> = {
  "Live Verified": "Confirmed by a live network probe",
  "Doc Supported": "Stated in official documentation",
  Uncertain: "Inferred or undocumented. Verify before relying on it",
};

export function EvidenceBadge({ label }: { label?: EvidenceLabel }) {
  if (!label) return null;
  return (
    <span
      title={HINT[label]}
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wide ${STYLE[label]}`}
    >
      {label}
    </span>
  );
}

const TAG_STYLE: Record<string, string> = {
  "LIVE PROBED": STYLE["Live Verified"],
  "DOC SUPPORTED": STYLE["Doc Supported"],
  UNCERTAIN: STYLE.Uncertain,
};

/** Renders "[LIVE PROBED] foo. [UNCERTAIN] bar." with the tags as chips, one claim per line. */
export function TaggedNotes({ text }: { text: string }) {
  const parts = text.split(/\[(LIVE PROBED|DOC SUPPORTED|UNCERTAIN)\]/);
  if (parts.length === 1) return <p className="text-sm leading-relaxed text-zinc-400">{text}</p>;
  const items: { tag?: string; body: string }[] = [];
  if (parts[0].trim()) items.push({ body: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) items.push({ tag: parts[i], body: (parts[i + 1] ?? "").trim() });
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-zinc-400">
          {it.tag ? (
            <span
              className={`mt-0.5 inline-flex shrink-0 rounded border px-1.5 py-px font-mono text-[10px] font-medium ${TAG_STYLE[it.tag]}`}
            >
              {it.tag}
            </span>
          ) : null}
          <Fragment>{it.body}</Fragment>
        </li>
      ))}
    </ul>
  );
}
