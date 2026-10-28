"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { InvestigationEvent, OAuthGuideSpec } from "@/types/oauth";
import { GuideView } from "@/components/guide/GuideView";

type Step = Extract<InvestigationEvent, { type: "step" }>;

const TIERS = [
  { tier: 1, label: "Probe", detail: "/.well-known discovery" },
  { tier: 2, label: "Crawl", detail: "Tavily / Firecrawl docs" },
  { tier: 3, label: "Synthesize", detail: "Gemini + evidence audit" },
] as const;

const STATUS_GLYPH: Record<Step["status"], { glyph: string; cls: string }> = {
  run: { glyph: "›", cls: "text-sky-400" },
  ok: { glyph: "✓", cls: "text-emerald-400" },
  warn: { glyph: "!", cls: "text-amber-400" },
  fail: { glyph: "✗", cls: "text-rose-400" },
};

/** Reads an NDJSON stream line by line. */
async function* readNdjson(res: Response): AsyncGenerator<InvestigationEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as InvestigationEvent;
    }
  }
  if (buf.trim()) yield JSON.parse(buf) as InvestigationEvent;
}

export function LiveInvestigation({ domain, initialGuide }: { domain: string; initialGuide?: OAuthGuideSpec }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [guide, setGuide] = useState<OAuthGuideSpec | null>(initialGuide ?? null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (refresh = false) => {
      setSteps([]);
      setError(null);
      setGuide(null);
      setRunning(true);
      const t0 = Date.now();
      const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
      try {
        const res = await fetch("/api/investigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, refresh }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        let gotResult = false;
        for await (const evt of readNdjson(res)) {
          if (evt.type === "step") setSteps((s) => [...s, evt]);
          else if (evt.type === "result") {
            gotResult = true;
            // Leave the finished log on screen for a moment so the run is legible.
            await new Promise((r) => setTimeout(r, 700));
            setGuide(evt.guide);
          } else if (evt.type === "error") throw new Error(evt.message);
        }
        if (!gotResult) throw new Error("Investigation ended without a result.");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        clearInterval(timer);
        setRunning(false);
      }
    },
    [domain],
  );

  // Ref guard: React StrictMode runs effects twice in dev. Don't start two investigations.
  useEffect(() => {
    if (started.current || initialGuide) return;
    started.current = true;
    void run();
  }, [run, initialGuide]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [steps.length]);

  if (guide) return <GuideView guide={guide} onRefresh={() => void run(true)} />;

  const activeTier = steps.length ? steps[steps.length - 1].tier : 0;
  const tierState = (t: number) => {
    const mine = steps.filter((s) => s.tier === t);
    if (!mine.length) return activeTier > t ? "skipped" : "pending";
    if (activeTier > t || (!running && !error)) return mine.some((s) => s.status === "fail") ? "fail" : "done";
    return running ? "active" : "fail";
  };

  return (
    <div>
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> All guides
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
        Investigating <span className="font-mono">{domain}</span>
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        No curated guide exists for this app, so the agent is investigating it live. Expect 20–90 seconds.
      </p>

      <ol className="mt-6 grid gap-2 sm:grid-cols-3">
        {TIERS.map(({ tier, label, detail }) => {
          const st = tierState(tier);
          return (
            <li
              key={tier}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                st === "active"
                  ? "border-sky-500/50 bg-sky-500/10"
                  : st === "done"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : st === "fail"
                      ? "border-rose-500/40 bg-rose-500/5"
                      : "border-zinc-800 bg-zinc-900/40"
              }`}
            >
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-500">TIER {tier}</span>
                <span className={st === "active" ? "animate-pulse text-sky-300" : st === "done" ? "text-emerald-400" : st === "fail" ? "text-rose-400" : "text-zinc-600"}>
                  {st === "active" ? "running" : st}
                </span>
              </div>
              <div className="mt-1 text-sm font-medium text-zinc-100">{label}</div>
              <div className="text-xs text-zinc-500">{detail}</div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="truncate px-3 font-mono text-xs text-zinc-500">agent@oauth-readiness: investigate {domain}</span>
          <span className="font-mono text-xs tabular-nums text-zinc-500">{elapsed}s</span>
        </div>
        <div ref={scroller} className="h-[22rem] overflow-y-auto p-4 font-mono text-[12.5px] leading-6 sm:h-[26rem]" role="log" aria-live="polite">
          <div className="text-zinc-500">$ curl -X POST /api/investigate -d {`'{"domain":"${domain}"}'`}</div>
          {steps.map((s, i) => {
            const g = STATUS_GLYPH[s.status];
            return (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-zinc-600">[{s.tier ? `T${s.tier}` : "--"}]</span>
                <span className={`shrink-0 ${g.cls}`}>{g.glyph}</span>
                <span className={`min-w-0 break-all ${s.status === "run" ? "text-zinc-300" : s.status === "fail" ? "text-rose-300" : s.status === "warn" ? "text-amber-200/80" : "text-zinc-400"}`}>
                  {s.message}
                </span>
              </div>
            );
          })}
          {running && (
            <div className="flex gap-2">
              <span className="text-zinc-600">[{activeTier ? `T${activeTier}` : "--"}]</span>
              <span className="inline-block h-4 w-2 translate-y-1 animate-pulse bg-zinc-300" />
            </div>
          )}
          {error && (
            <div className="mt-2 text-rose-400">
              ✗ investigation failed: <span className="break-all">{error}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            <RotateCcw className="h-4 w-4" /> Retry investigation
          </button>
          <span className="text-sm text-zinc-500">
            Model overloads (503) are usually temporary. Retrying in a few seconds often works.
          </span>
        </div>
      )}
    </div>
  );
}
