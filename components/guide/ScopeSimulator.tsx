"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { RiskLevel, ScopeDefinition } from "@/types/oauth";
import { EvidenceBadge } from "@/components/guide/Evidence";

const RISK_STYLE: Record<RiskLevel, string> = {
  low: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  medium: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  critical: "text-rose-300 border-rose-500/30 bg-rose-500/10",
};

interface Alert {
  kind: "audit" | "critical";
  title: string;
  scopes: string[];
}

/** Group selected high-risk scopes by banner text so one CASA warning covers gmail + drive. */
function buildAlerts(selected: ScopeDefinition[]): Alert[] {
  const byTitle = new Map<string, Alert>();
  for (const s of selected) {
    if (!s.triggersAudit && s.riskLevel !== "critical") continue;
    const kind = s.triggersAudit ? "audit" : "critical";
    const title =
      s.warning ??
      (kind === "audit" ? "Triggers provider review or verification" : "High-risk scope: expect admin or user pushback");
    const key = `${kind}:${title}`;
    const a = byTitle.get(key) ?? { kind, title, scopes: [] };
    a.scopes.push(s.scope);
    byTitle.set(key, a);
  }
  // Review/audit gates first: they decide the timeline.
  return [...byTitle.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "audit" ? -1 : 1));
}

export function ScopeSimulator({ scopes }: { scopes: ScopeDefinition[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const selected = useMemo(() => scopes.filter((s) => checked.has(s.scope)), [scopes, checked]);
  const alerts = useMemo(() => buildAlerts(selected), [selected]);
  const triggersReview = selected.some((s) => s.triggersAudit);

  const toggle = (scope: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-semibold text-zinc-100">Scope Simulator</h2>
          <p className="text-xs text-zinc-500">Tick the scopes your agent needs to see what each one sets off.</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-zinc-500">{selected.length} selected</span>
          {selected.length > 0 && (
            <span className={triggersReview ? "text-rose-300" : "text-emerald-300"}>
              {triggersReview ? "→ review required" : "→ ships without review"}
            </span>
          )}
          {selected.length > 0 && (
            <button type="button" onClick={() => setChecked(new Set())} className="text-zinc-500 hover:text-zinc-200">
              clear
            </button>
          )}
        </div>
      </header>

      <div aria-live="polite" className="space-y-2 px-4 pt-4 empty:hidden sm:px-5">
        {alerts.map((a) => (
          <div
            key={a.kind + a.title}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${
              a.kind === "audit"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                : "border-orange-500/40 bg-orange-500/10 text-orange-200"
            }`}
          >
            {a.kind === "audit" ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            )}
            <div className="min-w-0">
              <div className="font-medium">{a.title}</div>
              <div className="mt-0.5 break-all font-mono text-xs opacity-75">{a.scopes.join("  ·  ")}</div>
            </div>
          </div>
        ))}
        {selected.length > 0 && alerts.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            No selected scope triggers a review or carries critical risk.
          </div>
        )}
      </div>

      <ul className="divide-y divide-zinc-800/70 p-2">
        {scopes.map((s) => {
          const on = checked.has(s.scope);
          return (
            <li key={s.scope}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-3 transition-colors sm:px-3 ${on ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(s.scope)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-zinc-100"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all font-mono text-[13px] text-zinc-100">{s.scope}</code>
                    <span className={`rounded border px-1.5 py-px text-[10px] font-medium uppercase ${RISK_STYLE[s.riskLevel]}`}>
                      {s.riskLevel}
                    </span>
                    {s.triggersAudit && (
                      <span className="rounded border border-rose-500/40 px-1.5 py-px text-[10px] font-medium uppercase text-rose-300">
                        review
                      </span>
                    )}
                    <span className="ml-auto">
                      <EvidenceBadge label={s.evidence} />
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">{s.description}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
