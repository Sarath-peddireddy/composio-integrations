/**
 * Canonical data contract for every OAuth readiness guide.
 *
 * Curated seed guides (data/curated.ts) and live agent output (/api/investigate)
 * must both conform to OAuthGuideSpec, so the UI renders them identically.
 */

/** How much gatekeeping stands between "it works on localhost" and real users. */
export type FrictionTier =
  | "Instant (Zero Review)"
  | "Tenant Gated (Admin Approval)"
  | "Review Wall (Audit/Verification)";

export const FRICTION_TIERS: readonly FrictionTier[] = [
  "Instant (Zero Review)",
  "Tenant Gated (Admin Approval)",
  "Review Wall (Audit/Verification)",
] as const;

export type RiskLevel = "low" | "medium" | "critical";

/**
 * Where a claim comes from.
 * - Live Verified: our agent fetched it directly (e.g. a discovery document) and it matched.
 * - Doc Supported: stated in official provider documentation we cite.
 * - Uncertain: inferred, anecdotal, or undocumented (e.g. review turnaround, audit pricing).
 */
export type EvidenceLabel = "Live Verified" | "Doc Supported" | "Uncertain";

export interface ScopeDefinition {
  scope: string;
  riskLevel: RiskLevel;
  /** True if requesting this scope pulls the app into a formal review or security audit. */
  triggersAudit: boolean;
  description: string;
  evidence?: EvidenceLabel;
  /** Short banner shown in the Scope Simulator when selected, e.g. "Requires CASA Audit". */
  warning?: string;
}

export interface OAuthEndpoints {
  authorizationUrl?: string;
  tokenUrl?: string;
  issuer?: string;
  revocationUrl?: string;
  /** Present only when known; "unknown" when neither probe nor docs confirm it. */
  pkceSupported?: boolean | "unknown";
  /** Where the endpoints came from: a live discovery probe or the docs. */
  evidence?: EvidenceLabel;
}

export interface AgentVsHuman {
  /** Steps an agent can do end-to-end (discovery, code generation, PKCE params...). */
  agentAutomated: string[];
  /** Steps only the developer can do (DNS records, legal docs, screencasts, admin asks...). */
  humanRequired: string[];
}

export interface Confidence {
  status: "high" | "medium" | "low";
  /** True if at least one claim was confirmed by a live network probe. */
  verifiedLive: boolean;
  notes: string;
  /** ISO date the guide was last checked against sources. */
  lastChecked?: string;
}

/** A requirement or gotcha that could change the developer's plan. */
export interface Nuance {
  text: string;
  evidence: EvidenceLabel;
}

export interface SourceRef {
  title: string;
  url: string;
}

export interface Provenance {
  sources: SourceRef[];
  /** Things we could not verify and the developer should confirm themselves. */
  uncertainties: string[];
}

/** One network check the agent actually ran (Tier 1). */
export interface ProbeAttempt {
  url: string;
  /** HTTP status, or null when the request failed (timeout, DNS, TLS...). */
  status: number | null;
  ok: boolean;
  note?: string;
}

/** Audit trail for guides generated live by /api/investigate. Absent on curated guides. */
export interface InvestigationMeta {
  generatedAt: string;
  model: string;
  probes: ProbeAttempt[];
  /** Pages whose content was passed to the model. */
  docsCrawled: SourceRef[];
  /** Model claims the server rejected because no probe or source supported them. */
  rejectedClaims: string[];
}

export interface OAuthGuideSpec {
  /** URL-safe id used for /guides/[slug]. */
  slug: string;
  provider: string;
  domain: string;
  /** One-line summary shown on dashboard cards. */
  summary: string;
  frictionTier: FrictionTier;
  timeToDev: string;
  timeToProduction: string;
  requiresReview: boolean;
  endpoints: OAuthEndpoints;
  scopeMatrix: ScopeDefinition[];
  agentVsHuman: AgentVsHuman;
  directConsoleUrl: string;
  confidence: Confidence;
  nuances?: Nuance[];
  provenance?: Provenance;
  investigation?: InvestigationMeta;
}

/** NDJSON events streamed by POST /api/investigate, one JSON object per line. */
export type InvestigationEvent =
  | { type: "step"; tier: 0 | 1 | 2 | 3; status: "run" | "ok" | "warn" | "fail"; message: string }
  | { type: "result"; guide: OAuthGuideSpec; cached?: boolean }
  | { type: "error"; message: string };
