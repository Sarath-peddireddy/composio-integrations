"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileWarning,
  Link2,
  Radar,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { OAuthGuideSpec } from "@/types/oauth";
import { FrictionBadge } from "@/components/FrictionBadge";
import { EvidenceBadge, TaggedNotes } from "@/components/guide/Evidence";
import { TimeGauge } from "@/components/guide/TimeGauge";
import { ScopeSimulator } from "@/components/guide/ScopeSimulator";
import { ActionPlan } from "@/components/guide/ActionPlan";
import { guideToMarkdown } from "@/lib/markdown";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`${label} ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-100">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function GuideView({ guide, onRefresh }: { guide: OAuthGuideSpec; onRefresh?: () => void }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const e = guide.endpoints;
  const inv = guide.investigation;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {}
  };

  const exportMarkdown = () => {
    const md = guideToMarkdown(guide, window.location.href);
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${guide.slug.replace(/[^a-z0-9.-]/gi, "-")}-oauth-guide.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const endpointRows: [string, string | undefined][] = [
    ["Authorization", e.authorizationUrl],
    ["Token", e.tokenUrl],
    ["Issuer", e.issuer],
    ["Revocation", e.revocationUrl],
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> All guides
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 font-mono text-base font-semibold text-zinc-200">
                {guide.provider.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{guide.provider}</h1>
                <p className="font-mono text-sm text-zinc-500">{guide.domain}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FrictionBadge tier={guide.frictionTier} />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                {guide.requiresReview ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {guide.requiresReview ? "Provider review required" : "No mandatory review"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                {inv ? <Sparkles className="h-3.5 w-3.5 text-sky-400" /> : <Check className="h-3.5 w-3.5 text-zinc-400" />}
                {inv ? `Generated live · ${inv.generatedAt.slice(0, 16).replace("T", " ")} UTC` : `Curated · checked ${guide.confidence.lastChecked ?? "n/a"}`}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                Confidence: <span className="font-medium text-zinc-200">{guide.confidence.status}</span>
                {guide.confidence.verifiedLive && <Radar className="h-3.5 w-3.5 text-sky-400" aria-label="Live probed" />}
              </span>
            </div>
            {guide.summary && <p className="mt-4 max-w-3xl text-zinc-400">{guide.summary}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            >
              {linkCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
              {linkCopied ? "Link copied" : "Copy Shareable Link"}
            </button>
            <button
              type="button"
              onClick={exportMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            >
              <Download className="h-4 w-4" /> Export Markdown
            </button>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Re-run the live investigation"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
              >
                <RefreshCw className="h-4 w-4" /> Re-investigate
              </button>
            )}
            <a
              href={guide.directConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              Open console <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <TimeGauge timeToDev={guide.timeToDev} timeToProduction={guide.timeToProduction} tier={guide.frictionTier} />

      <ScopeSimulator scopes={guide.scopeMatrix} />

      <ActionPlan guide={guide} />

      {guide.nuances && guide.nuances.length > 0 && (
        <Card title="Requirements & gotchas">
          <ul className="space-y-3">
            {guide.nuances.map((n) => (
              <li key={n.text} className="flex flex-col gap-1.5 text-sm text-zinc-300 sm:flex-row sm:items-start sm:gap-3">
                <span className="sm:w-28 sm:shrink-0 sm:pt-0.5">
                  <EvidenceBadge label={n.evidence} />
                </span>
                <span className="leading-relaxed">{n.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Endpoints" right={<EvidenceBadge label={e.evidence} />}>
          <dl className="space-y-2.5">
            {endpointRows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6.5rem_1fr] items-start gap-2">
                <dt className="pt-0.5 text-xs uppercase tracking-wider text-zinc-500">{k}</dt>
                <dd className="flex min-w-0 items-start gap-1">
                  {v ? (
                    <>
                      <code className="min-w-0 break-all font-mono text-[13px] text-zinc-200">{v}</code>
                      <CopyButton value={v} label={`Copy ${k} URL`} />
                    </>
                  ) : (
                    <span className="text-sm italic text-zinc-500">not confirmed</span>
                  )}
                </dd>
              </div>
            ))}
            <div className="grid grid-cols-[6.5rem_1fr] items-start gap-2">
              <dt className="pt-0.5 text-xs uppercase tracking-wider text-zinc-500">PKCE S256</dt>
              <dd className="text-sm text-zinc-300">
                {e.pkceSupported === true ? "Supported" : e.pkceSupported === false ? "Not supported" : <span className="italic text-zinc-500">unknown</span>}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Evidence">
          <TaggedNotes text={guide.confidence.notes} />
          {guide.provenance && guide.provenance.uncertainties.length > 0 && (
            <div className="mt-5">
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-amber-300/90">
                <FileWarning className="h-3.5 w-3.5" /> Could not verify
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-400 marker:text-zinc-600">
                {guide.provenance.uncertainties.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          {inv && inv.rejectedClaims.length > 0 && (
            <div className="mt-5">
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-rose-300/90">
                <XCircle className="h-3.5 w-3.5" /> Rejected model claims
              </h3>
              <ul className="mt-2 space-y-1.5 font-mono text-xs text-zinc-500">
                {inv.rejectedClaims.map((c) => (
                  <li key={c} className="break-all">{c}</li>
                ))}
              </ul>
            </div>
          )}
          {inv && (
            <div className="mt-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Live probes</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {inv.probes.map((p) => (
                  <li key={p.url} className="flex gap-2 break-all">
                    <span className={p.ok ? "text-emerald-400" : "text-zinc-500"}>{p.status ?? "ERR"}</span>
                    <span className="text-zinc-400">{p.url}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {guide.provenance && guide.provenance.sources.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Sources</h3>
              <ul className="mt-2 space-y-1.5">
                {guide.provenance.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-start gap-1.5 text-sm text-zinc-300 hover:text-zinc-50"
                    >
                      <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
                      <span>
                        {s.title} <span className="break-all font-mono text-xs text-zinc-600">{hostOf(s.url)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
