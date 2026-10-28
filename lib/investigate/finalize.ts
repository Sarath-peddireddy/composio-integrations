import type {
  EvidenceLabel,
  FrictionTier,
  OAuthGuideSpec,
  ProbeAttempt,
  RiskLevel,
  ScopeDefinition,
  SourceRef,
} from "@/types/oauth";
import { FRICTION_TIERS } from "@/types/oauth";
import type { DiscoveryDoc } from "@/lib/investigate/probe";
import type { CrawledDoc } from "@/lib/investigate/crawl";
import type { ModelGuide } from "@/lib/investigate/synthesize";

const EVIDENCE: EvidenceLabel[] = ["Live Verified", "Doc Supported", "Uncertain"];
const RISK: RiskLevel[] = ["low", "medium", "critical"];
const TAG_RE = /\[(LIVE PROBED|DOC SUPPORTED|UNCERTAIN)\]/;

interface FinalizeInput {
  domain: string;
  model: string;
  raw: ModelGuide;
  probes: ProbeAttempt[];
  discovery: DiscoveryDoc | null;
  docs: CrawledDoc[];
  corpus: string;
}

const trimSlash = (u: string) => u.replace(/\/+$/, "");
const nonEmpty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const cleanList = (xs: unknown) => (Array.isArray(xs) ? xs.filter(nonEmpty).map((s) => s.trim()) : []);

function titleFromDomain(domain: string): string {
  const label = domain.split(".").slice(-2, -1)[0] ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The model's output is a draft. This step re-checks it against what the
 * agent actually observed:
 * - Endpoints come only from the live probe, or from URLs present verbatim in crawled docs.
 * - Evidence labels are downgraded when the claimed evidence doesn't exist.
 * - Sources are limited to pages actually crawled.
 * Every rejection is recorded so the UI can show it.
 */
export function finalizeGuide(input: FinalizeInput): OAuthGuideSpec {
  const { domain, model, raw, probes, discovery, docs, corpus } = input;
  const rejected: string[] = [];
  const uncertainties = cleanList(raw.provenance?.uncertainties);
  const haveDocs = docs.length > 0;
  const inCorpus = (s: string) => corpus.includes(trimSlash(s));

  /** Never let a label claim stronger evidence than we have. */
  const capEvidence = (label: unknown, docCheck?: string): EvidenceLabel => {
    let l: EvidenceLabel = EVIDENCE.includes(label as EvidenceLabel) ? (label as EvidenceLabel) : "Uncertain";
    if (l === "Live Verified" && !discovery) l = "Doc Supported";
    if (l === "Doc Supported" && (!haveDocs || (docCheck !== undefined && !inCorpus(docCheck)))) l = "Uncertain";
    return l;
  };

  // ---- Endpoints (zero-hallucination rule) ----
  const e = raw.endpoints ?? ({} as ModelGuide["endpoints"]);
  let endpoints: OAuthGuideSpec["endpoints"];
  if (discovery) {
    const methods = discovery.code_challenge_methods_supported;
    endpoints = {
      authorizationUrl: discovery.authorization_endpoint,
      tokenUrl: discovery.token_endpoint,
      issuer: discovery.issuer,
      revocationUrl: discovery.revocation_endpoint,
      pkceSupported: methods ? methods.includes("S256") : "unknown",
      evidence: "Live Verified",
    };
    if (!methods) uncertainties.push("Discovery document does not list code_challenge_methods_supported, so PKCE support is unconfirmed.");
  } else {
    const keep = (name: string, url: string): string | undefined => {
      if (!nonEmpty(url)) return undefined;
      if (url.startsWith("https://") && inCorpus(url)) return url;
      rejected.push(`${name} "${url}" (not found in any probe or crawled source)`);
      return undefined;
    };
    endpoints = {
      authorizationUrl: keep("authorizationUrl", e.authorizationUrl),
      tokenUrl: keep("tokenUrl", e.tokenUrl),
      issuer: keep("issuer", e.issuer),
      revocationUrl: keep("revocationUrl", e.revocationUrl),
    };
    const kept = Object.values(endpoints).some(Boolean);
    endpoints.evidence = kept ? "Doc Supported" : "Uncertain";
    const mentionsPkce = /pkce|code_challenge/i.test(corpus);
    endpoints.pkceSupported = mentionsPkce && e.pkceSupported !== "unknown" ? e.pkceSupported === "true" : "unknown";
    if (!kept) uncertainties.unshift("No OAuth endpoints could be confirmed. Copy them from the provider's docs before you write code.");
  }

  // ---- Scopes ----
  const liveScopes = new Set(discovery?.scopes_supported ?? []);
  const scopeMatrix: ScopeDefinition[] = (raw.scopeMatrix ?? [])
    .filter((s) => nonEmpty(s?.scope))
    .slice(0, 12)
    .map((s) => {
      const riskLevel = RISK.includes(s.riskLevel as RiskLevel) ? (s.riskLevel as RiskLevel) : "medium";
      const evidence: EvidenceLabel = liveScopes.has(s.scope) ? "Live Verified" : capEvidence(s.evidence, s.scope);
      return {
        scope: s.scope.trim(),
        riskLevel,
        triggersAudit: Boolean(s.triggersAudit),
        description: (s.description ?? "").trim(),
        evidence,
        warning: nonEmpty(s.warning) ? s.warning.trim().slice(0, 90) : undefined,
      };
    });

  // ---- Console URL ----
  let directConsoleUrl = nonEmpty(raw.directConsoleUrl) ? raw.directConsoleUrl.trim() : "";
  if (directConsoleUrl && !(directConsoleUrl.startsWith("https://") && inCorpus(directConsoleUrl))) {
    rejected.push(`directConsoleUrl "${directConsoleUrl}" (not found in crawled sources)`);
    directConsoleUrl = "";
  }
  if (!directConsoleUrl) {
    directConsoleUrl = docs[0]?.url ?? `https://${domain}`;
    uncertainties.push("The developer console URL was not confirmed. The link points to the best available docs page instead.");
  }

  // ---- Sources: only what we actually fetched ----
  const sources: SourceRef[] = docs.map((d) => ({ title: d.title, url: d.url }));
  if (discovery) sources.push({ title: "Discovery document (live probe)", url: discovery.sourceUrl });
  const crawledUrls = new Set(sources.map((s) => trimSlash(s.url)));
  for (const s of raw.provenance?.sources ?? []) {
    if (nonEmpty(s?.url) && !crawledUrls.has(trimSlash(s.url))) rejected.push(`source "${s.url}" (model cited a page the agent never fetched)`);
  }

  // ---- Confidence ----
  const okProbe = probes.find((p) => p.ok);
  const probeSentence = okProbe
    ? `[LIVE PROBED] ${okProbe.url} returned ${okProbe.status} with a valid discovery document.`
    : `[LIVE PROBED] No discovery document at either /.well-known path (${probes
        .map((p) => p.status ?? p.note ?? "failed")
        .join(", ")}).`;
  let modelNotes = (raw.confidence?.notes ?? "").trim();
  if (modelNotes && !TAG_RE.test(modelNotes)) modelNotes = `[UNCERTAIN] ${modelNotes}`;

  let status = (["high", "medium", "low"] as const).find((s) => s === raw.confidence?.status) ?? "low";
  if (!haveDocs) status = "low";
  else if (!discovery && docs.length < 2 && status === "high") status = "medium";
  if (rejected.length >= 3 && status === "high") status = "medium";

  const frictionTier: FrictionTier = FRICTION_TIERS.includes(raw.frictionTier as FrictionTier)
    ? (raw.frictionTier as FrictionTier)
    : raw.requiresReview
      ? "Review Wall (Audit/Verification)"
      : "Tenant Gated (Admin Approval)";

  return {
    slug: domain,
    provider: nonEmpty(raw.provider) ? raw.provider.trim() : titleFromDomain(domain),
    domain,
    summary: (raw.summary ?? "").trim(),
    frictionTier,
    timeToDev: nonEmpty(raw.timeToDev) ? raw.timeToDev : "Unknown",
    timeToProduction: nonEmpty(raw.timeToProduction) ? raw.timeToProduction : "Unknown",
    requiresReview: Boolean(raw.requiresReview),
    endpoints,
    scopeMatrix,
    agentVsHuman: {
      agentAutomated: cleanList(raw.agentVsHuman?.agentAutomated),
      humanRequired: cleanList(raw.agentVsHuman?.humanRequired),
    },
    directConsoleUrl,
    confidence: {
      status,
      verifiedLive: Boolean(discovery),
      notes: [probeSentence, modelNotes].filter(Boolean).join(" "),
      lastChecked: new Date().toISOString().slice(0, 10),
    },
    nuances: (raw.nuances ?? [])
      .filter((n) => nonEmpty(n?.text))
      .map((n) => ({ text: n.text.trim(), evidence: capEvidence(n.evidence) })),
    provenance: { sources, uncertainties: [...new Set(uncertainties)] },
    investigation: {
      generatedAt: new Date().toISOString(),
      model,
      probes,
      docsCrawled: docs.map((d) => ({ title: d.title, url: d.url })),
      rejectedClaims: rejected,
    },
  };
}
