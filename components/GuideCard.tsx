import { Clock, ExternalLink, Radar, Rocket, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { OAuthGuideSpec } from "@/types/oauth";
import { FrictionBadge, FrictionMeter } from "@/components/FrictionBadge";

export function GuideCard({ guide }: { guide: OAuthGuideSpec }) {
  const critical = guide.scopeMatrix.filter((s) => s.riskLevel === "critical").length;
  const auditing = guide.scopeMatrix.filter((s) => s.triggersAudit).length;

  return (
    <article className="group relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-sm font-semibold text-zinc-200">
            {guide.provider.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-100">
              {/* Stretched link: the whole card is clickable; the Console link sits above it. */}
              <Link href={`/guides/${guide.slug}`} className="after:absolute after:inset-0 after:rounded-xl after:content-['']">
                {guide.provider}
              </Link>
            </h3>
            <p className="truncate font-mono text-xs text-zinc-500">{guide.domain}</p>
          </div>
        </div>
        <FrictionBadge tier={guide.frictionTier} />
      </header>

      <div className="mt-4">
        <FrictionMeter tier={guide.frictionTier} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-zinc-400">{guide.summary}</p>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
            <Clock className="h-3 w-3" /> Dev ready
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-100">{guide.timeToDev}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
            <Rocket className="h-3 w-3" /> Production
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-100">{guide.timeToProduction}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-xs text-zinc-500">
        <span>{guide.scopeMatrix.length} scopes</span>
        <span className={critical ? "text-rose-300/80" : undefined}>{critical} critical</span>
        <span className={auditing ? "text-amber-300/80" : undefined}>
          {auditing ? `${auditing} trigger review` : "no review triggers"}
        </span>
      </div>

      <div className="min-h-5 flex-1" />
      <footer className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-400">
          {guide.requiresReview ? (
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {guide.requiresReview ? "Review required" : "No mandatory review"}
          {guide.confidence.verifiedLive && (
            <span
              title="Endpoints confirmed by a live discovery probe"
              className="ml-1 inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-px text-[10px] font-medium text-sky-300"
            >
              <Radar className="h-3 w-3" /> Live probed
            </span>
          )}
        </span>
        <a
          href={guide.directConsoleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 flex shrink-0 items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-100"
        >
          Console <ExternalLink className="h-3 w-3" />
        </a>
      </footer>
    </article>
  );
}
