"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Radar, Search } from "lucide-react";
import type { FrictionTier, OAuthGuideSpec } from "@/types/oauth";
import { FRICTION_TIERS } from "@/types/oauth";
import { TIER_META } from "@/lib/friction";
import { GuideCard } from "@/components/GuideCard";
import { toDomain } from "@/lib/domain";

type Filter = "All" | FrictionTier;

function matches(guide: OAuthGuideSpec, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const domain = toDomain(needle);
  if (domain && (guide.domain === domain || domain.endsWith(`.${guide.domain}`))) return true;
  return [guide.provider, guide.domain, guide.summary, guide.frictionTier]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function Dashboard({ guides }: { guides: OAuthGuideSpec[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the omnibar, like most developer tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searched = useMemo(() => guides.filter((g) => matches(g, query)), [guides, query]);
  const visible = filter === "All" ? searched : searched.filter((g) => g.frictionTier === filter);
  const domain = toDomain(query);
  const showInvestigate = Boolean(query.trim()) && searched.length === 0;

  const countFor = (f: Filter) =>
    f === "All" ? searched.length : searched.filter((g) => g.frictionTier === f).length;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (visible.length === 1) router.push(`/guides/${visible[0].slug}`);
          else if (showInvestigate && domain) router.push(`/guides/${encodeURIComponent(domain)}`);
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Paste an app domain or search..."
          spellCheck={false}
          autoComplete="off"
          aria-label="Search guides or enter an app domain"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 py-4 pl-12 pr-14 font-mono text-[15px] text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900 focus:ring-4 focus:ring-zinc-700/30"
        />
        <kbd className="pointer-events-none absolute right-4 top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[11px] text-zinc-400">
          {query ? <CornerDownLeft className="h-3 w-3" /> : "/"}
        </kbd>
      </form>

      {showInvestigate && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm">
          <Radar className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <p className="text-zinc-400">
            {domain ? (
              <>
                No curated guide for <span className="font-mono text-zinc-200">{domain}</span>.{" "}
                <button
                  type="button"
                  onClick={() => router.push(`/guides/${encodeURIComponent(domain)}`)}
                  className="font-medium text-sky-300 underline-offset-4 hover:underline"
                >
                  Investigate it live →
                </button>{" "}
                <span className="text-zinc-500">(or press Enter)</span>
              </>
            ) : (
              <>No curated guide matches that search. Paste the app&apos;s domain (e.g. notion.so) to investigate it live.</>
            )}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by friction tier">
        {(["All", ...FRICTION_TIERS] as Filter[]).map((f) => {
          const active = filter === f;
          const meta = f === "All" ? null : TIER_META[f];
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f)}
              title={f}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {meta && <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
              {meta ? meta.short : "All"}
              <span className={`font-mono ${active ? "text-zinc-500" : "text-zinc-600"}`}>{countFor(f)}</span>
            </button>
          );
        })}
      </div>

      {visible.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((g) => (
            <GuideCard key={g.slug} guide={g} />
          ))}
        </div>
      ) : (
        !showInvestigate && (
          <p className="mt-10 text-center text-sm text-zinc-500">No guides in this tier match your search.</p>
        )
      )}
    </div>
  );
}
