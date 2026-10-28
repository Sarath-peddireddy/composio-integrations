"use client";

import { useEffect, useState } from "react";
import { Bot, Check, CircleCheck, User } from "lucide-react";
import type { OAuthGuideSpec } from "@/types/oauth";

/** Things the agent actually did while generating a live guide (not just could do). */
function performedSteps(g: OAuthGuideSpec): string[] {
  const inv = g.investigation;
  if (!inv) return [];
  const hit = inv.probes.find((p) => p.ok);
  const steps = [
    hit
      ? `Probed ${inv.probes.length} discovery endpoints. Found a live document at ${new URL(hit.url).pathname}`
      : `Probed ${inv.probes.length} discovery endpoints. None published, so endpoints come from docs`,
    `Crawled ${inv.docsCrawled.length} documentation page(s) for registration, scope, and review rules`,
    `Synthesized this guide with ${inv.model} under a strict JSON schema`,
  ];
  steps.push(
    inv.rejectedClaims.length
      ? `Rejected ${inv.rejectedClaims.length} model claim(s) that no probe or source supported`
      : "Checked every endpoint and source against the evidence. Nothing had to be rejected",
  );
  return steps;
}

export function ActionPlan({ guide }: { guide: OAuthGuideSpec }) {
  const storageKey = `oauth-readiness:progress:${guide.slug}`;
  const [done, setDone] = useState<Set<number>>(new Set());

  // Checklist progress is a per-viewer convenience; storage may be unavailable.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set(JSON.parse(raw) as number[]));
    } catch {}
  }, [storageKey]);

  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });

  const performed = performedSteps(guide);
  const human = guide.agentVsHuman.humanRequired;

  return (
    <section>
      <h2 className="mb-3 font-semibold text-zinc-100">Action Plan</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-200">
            <Bot className="h-4 w-4" /> What the Agent Automated
          </h3>
          {performed.length > 0 && (
            <>
              <p className="mt-4 text-[11px] uppercase tracking-wider text-zinc-500">Done during this investigation</p>
              <ul className="mt-2 space-y-2">
                {performed.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 text-[11px] uppercase tracking-wider text-zinc-500">Your coding agent can generate</p>
          <ul className="mt-2 space-y-2">
            {guide.agentVsHuman.agentAutomated.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-zinc-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400/70" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 sm:p-5">
          <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-amber-200">
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" /> What You Must Do
            </span>
            <span className="font-mono text-xs font-normal text-zinc-500">
              {done.size}/{human.length} done
            </span>
          </h3>
          <ol className="mt-4 space-y-1">
            {human.map((s, i) => {
              const on = done.has(i);
              return (
                <li key={s}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-800/30">
                    <input type="checkbox" checked={on} onChange={() => toggle(i)} className="sr-only" />
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
                        on ? "border-amber-400 bg-amber-400 text-zinc-900" : "border-zinc-600 text-zinc-400"
                      }`}
                    >
                      {on ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={`text-sm ${on ? "text-zinc-500 line-through" : "text-zinc-300"}`}>{s}</span>
                  </label>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
