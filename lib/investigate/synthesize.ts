import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import { FRICTION_TIERS } from "@/types/oauth";
import type { DiscoveryDoc } from "@/lib/investigate/probe";
import type { CrawledDoc } from "@/lib/investigate/crawl";

const EVIDENCE = ["Live Verified", "Doc Supported", "Uncertain"];

/**
 * responseSchema mirroring OAuthGuideSpec. Optional fields use "" (not null)
 * because empty strings are easier for the model to emit consistently. The
 * finalize step converts them back to undefined.
 * slug and investigation are server-owned and not part of the model's output.
 */
const sourceRef: Schema = {
  type: Type.OBJECT,
  properties: { title: { type: Type.STRING }, url: { type: Type.STRING } },
  required: ["title", "url"],
};

export const GUIDE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    provider: { type: Type.STRING, description: "Human-readable product name, e.g. 'Notion'." },
    domain: { type: Type.STRING },
    summary: { type: Type.STRING, description: "One sentence, max 30 words: how hard it is to get to production." },
    frictionTier: { type: Type.STRING, format: "enum", enum: [...FRICTION_TIERS] },
    timeToDev: { type: Type.STRING, description: "Time to a working OAuth flow in development, e.g. '10 minutes'." },
    timeToProduction: { type: Type.STRING, description: "Realistic range to serve external users, e.g. 'Same day' or '2 – 6 weeks'." },
    requiresReview: { type: Type.BOOLEAN },
    endpoints: {
      type: Type.OBJECT,
      properties: {
        authorizationUrl: { type: Type.STRING },
        tokenUrl: { type: Type.STRING },
        issuer: { type: Type.STRING },
        revocationUrl: { type: Type.STRING },
        pkceSupported: { type: Type.STRING, format: "enum", enum: ["true", "false", "unknown"] },
        evidence: { type: Type.STRING, format: "enum", enum: EVIDENCE },
      },
      required: ["authorizationUrl", "tokenUrl", "issuer", "revocationUrl", "pkceSupported", "evidence"],
      propertyOrdering: ["authorizationUrl", "tokenUrl", "issuer", "revocationUrl", "pkceSupported", "evidence"],
    },
    scopeMatrix: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "12",
      items: {
        type: Type.OBJECT,
        properties: {
          scope: { type: Type.STRING },
          riskLevel: { type: Type.STRING, format: "enum", enum: ["low", "medium", "critical"] },
          triggersAudit: { type: Type.BOOLEAN },
          description: { type: Type.STRING },
          evidence: { type: Type.STRING, format: "enum", enum: EVIDENCE },
          warning: { type: Type.STRING, description: "Banner text (max 70 chars) if critical or triggersAudit, else ''." },
        },
        required: ["scope", "riskLevel", "triggersAudit", "description", "evidence", "warning"],
        propertyOrdering: ["scope", "riskLevel", "triggersAudit", "description", "evidence", "warning"],
      },
    },
    agentVsHuman: {
      type: Type.OBJECT,
      properties: {
        agentAutomated: { type: Type.ARRAY, items: { type: Type.STRING } },
        humanRequired: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["agentAutomated", "humanRequired"],
    },
    directConsoleUrl: { type: Type.STRING },
    confidence: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, format: "enum", enum: ["high", "medium", "low"] },
        verifiedLive: { type: Type.BOOLEAN },
        notes: { type: Type.STRING },
      },
      required: ["status", "verifiedLive", "notes"],
      propertyOrdering: ["status", "verifiedLive", "notes"],
    },
    nuances: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          evidence: { type: Type.STRING, format: "enum", enum: EVIDENCE },
        },
        required: ["text", "evidence"],
      },
    },
    provenance: {
      type: Type.OBJECT,
      properties: {
        sources: { type: Type.ARRAY, items: sourceRef },
        uncertainties: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["sources", "uncertainties"],
    },
  },
  required: [
    "provider", "domain", "summary", "frictionTier", "timeToDev", "timeToProduction", "requiresReview",
    "endpoints", "scopeMatrix", "agentVsHuman", "directConsoleUrl", "confidence", "nuances", "provenance",
  ],
  propertyOrdering: [
    "provider", "domain", "summary", "frictionTier", "timeToDev", "timeToProduction", "requiresReview",
    "endpoints", "scopeMatrix", "agentVsHuman", "directConsoleUrl", "confidence", "nuances", "provenance",
  ],
};

/** Raw model output: same shape as OAuthGuideSpec, with "" for unknowns. */
export interface ModelGuide {
  provider: string;
  domain: string;
  summary: string;
  frictionTier: string;
  timeToDev: string;
  timeToProduction: string;
  requiresReview: boolean;
  endpoints: {
    authorizationUrl: string;
    tokenUrl: string;
    issuer: string;
    revocationUrl: string;
    pkceSupported: "true" | "false" | "unknown";
    evidence: string;
  };
  scopeMatrix: {
    scope: string;
    riskLevel: string;
    triggersAudit: boolean;
    description: string;
    evidence: string;
    warning: string;
  }[];
  agentVsHuman: { agentAutomated: string[]; humanRequired: string[] };
  directConsoleUrl: string;
  confidence: { status: string; verifiedLive: boolean; notes: string };
  nuances: { text: string; evidence: string }[];
  provenance: { sources: { title: string; url: string }[]; uncertainties: string[] };
}

const SYSTEM_INSTRUCTION = `You are an OAuth integration analyst. A developer building an AI agent wants their users to connect a third-party app. Tell them how hard it is to get a provider OAuth app registered, approved, and ready for production, and exactly what they must do.

You receive two evidence blocks:
- TIER 1 (LIVE PROBE): raw JSON our server fetched just now from the provider's /.well-known discovery endpoints, or a note that none exists.
- TIER 2 (DOCS): numbered excerpts [S1], [S2]... of documentation pages, each with its URL.

Hard rules:
1. ENDPOINTS: Zero hallucination. If TIER 1 contains endpoints, copy them exactly. Otherwise use only URLs that appear verbatim in TIER 2. Never construct a URL from a typical pattern. Use "" when unknown.
2. EVIDENCE LABELS for every scope and nuance:
   - "Live Verified": only for facts present in the TIER 1 JSON.
   - "Doc Supported": only for facts stated in a TIER 2 source.
   - "Uncertain": everything else, including your general knowledge.
3. CONFIDENCE NOTES: write 2-5 short sentences in confidence.notes. Start EVERY sentence with exactly one tag: "[LIVE PROBED]", "[DOC SUPPORTED]", or "[UNCERTAIN]". Example: "[LIVE PROBED] Discovery document exposes authorization and token endpoints. [DOC SUPPORTED] Public apps must pass a security review [S2]. [UNCERTAIN] Review turnaround is not published."
4. TIMELINES: Providers rarely publish review SLAs. If the sources give no timeline, give a cautious range and add an entry to provenance.uncertainties explaining that it is an estimate. Never state an undocumented number as fact. Never guess private pricing (e.g. security audit fees); list it as uncertain.
5. FRICTION TIER:
   - "Instant (Zero Review)": any developer can register an app and serve unlimited external users with no provider review.
   - "Tenant Gated (Admin Approval)": no mandatory provider review, but each customer org/workspace admin must approve or install the app, or wide distribution needs an optional marketplace review.
   - "Review Wall (Audit/Verification)": the provider must review, verify, or security-audit the app (or impose user caps) before it can serve external users at scale with the scopes an agent typically needs.
   requiresReview is true only if a provider review is mandatory before production for typical agent scopes.
6. SCOPES: list 4-10 real scope strings, prioritising the read/write scopes an AI agent would actually request. Use exact strings from the sources or scopes_supported. riskLevel "critical" = broad write/delete/admin or private-content access. triggersAudit = requesting it forces a provider review, verification, or security assessment. For critical or triggersAudit scopes, "warning" is a short banner (max 70 chars) such as "Requires CASA Audit" or "Workspace Admin Consent Required". Otherwise "".
7. ACTION PLAN: agentAutomated = concrete things a coding agent can do for the developer (resolve endpoints, generate authorize URL with PKCE/state, scaffold callback and token refresh, pick minimal scopes, draft review justifications). humanRequired = steps only a human can do (console clicks, accepting terms, DNS/domain verification, privacy policy, demo videos, admin approvals, paid audits, replying to reviewers). Be specific to this provider, imperative, max 20 words each, 4-8 items each.
8. directConsoleUrl: the developer portal page where OAuth apps are created, only if its URL appears in TIER 2 or TIER 1. Otherwise "".
9. provenance.sources: only cite URLs listed in TIER 2 or TIER 1. Never invent sources.
10. If evidence is thin, say so: set confidence.status to "low" and explain in the notes. A short, honest guide beats a confident, wrong one.`;

function buildPrompt(domain: string, discovery: DiscoveryDoc | null, probeSummary: string, docs: CrawledDoc[], corpus: string) {
  const tier1 = discovery
    ? JSON.stringify(discovery, null, 2)
    : `NO DISCOVERY DOCUMENT FOUND.\n${probeSummary}\nEndpoints must therefore come from TIER 2 sources or be left "".`;
  const tier2 = corpus || "NO DOCUMENTATION RETRIEVED. Rely on rule 10: low confidence, and mark claims Uncertain.";
  return `Target app domain: ${domain}

=== TIER 1 (LIVE PROBE) ===
${tier1}

=== TIER 2 (DOCS: ${docs.length} source(s), truncated) ===
${tier2}

Produce the OAuthGuideSpec JSON for ${domain}.`;
}

export interface SynthesisResult {
  guide: ModelGuide;
  model: string;
}

/** Gemini SDK errors carry a JSON body in .message. Pull out code and a short message. */
function describe(err: unknown): { code: number | null; message: string } {
  const raw = String((err as Error)?.message ?? err);
  try {
    const j = JSON.parse(raw.slice(raw.indexOf("{")));
    return { code: j.error?.code ?? null, message: String(j.error?.message ?? raw).split(". ")[0] };
  } catch {
    const code = raw.match(/\b([45]\d\d)\b/)?.[1];
    return { code: code ? Number(code) : null, message: raw.slice(0, 160) };
  }
}

/** Newest first. Overloaded (503) or retired (404) models fall through to the next one. */
const CALL_TIMEOUT_MS = 40_000;
const TOTAL_BUDGET_MS = 95_000;
const MAX_PASSES = 3;
const DEFAULT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
];

/**
 * Tier 3: Gemini synthesis with strict responseSchema.
 * Rotates through fallback API keys and models on quota / availability errors.
 */
export async function synthesizeGuide(
  domain: string,
  discovery: DiscoveryDoc | null,
  probeSummary: string,
  docs: CrawledDoc[],
  corpus: string,
  log: (status: "run" | "ok" | "warn" | "fail", message: string) => void,
): Promise<SynthesisResult> {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_FB1_API_KEY, process.env.GEMINI_FB2_API_KEY].filter(
    (k): k is string => Boolean(k),
  );
  if (!keys.length) throw new Error("GEMINI_API_KEY is not set on the server.");

  const models = [...new Set([process.env.GEMINI_MODEL, ...DEFAULT_MODELS].filter((m): m is string => Boolean(m)))];
  const prompt = buildPrompt(domain, discovery, probeSummary, docs, corpus);
  let lastErr: unknown;

  // Models that can never work (retired / invalid). Overloaded ones get another pass.
  const dead = new Set<string>();
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    if (pass > 1) {
      const wait = 2500 * (pass - 1);
      if (Date.now() + wait + 5_000 > deadline) break;
      log("run", `All models busy. Backing off ${wait / 1000}s before retry pass ${pass}/${MAX_PASSES}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  modelLoop: for (const model of models) {
    if (dead.has(model)) continue;
    if (Date.now() > deadline) break;
    for (const [i, apiKey] of keys.entries()) {
      log("run", `gemini.generateContent model=${model}${i ? ` (fallback key ${i})` : ""}`);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: GUIDE_RESPONSE_SCHEMA,
            temperature: 0.2,
            // Extraction task: low thinking keeps a live run well under a minute.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(Math.max(5_000, Math.min(CALL_TIMEOUT_MS, deadline - Date.now()))),
          },
        });
        const text = res.text;
        if (!text) throw new Error("Empty response from Gemini");
        const guide = JSON.parse(text) as ModelGuide;
        log("ok", `Structured guide received (${text.length.toLocaleString()} chars, schema-enforced)`);
        return { guide, model };
      } catch (err) {
        if (err instanceof SyntaxError) {
          lastErr = err;
          log("warn", `${model} returned malformed JSON, retrying`);
          continue;
        }
        if ((err as Error)?.name === "AbortError" || /aborted|timed? ?out/i.test(String((err as Error)?.message))) {
          lastErr = new Error(`Gemini timed out after ${CALL_TIMEOUT_MS / 1000}s`);
          log("warn", `${model} timed out after ${CALL_TIMEOUT_MS / 1000}s, trying next model`);
          continue modelLoop;
        }
        const { code, message } = describe(err);
        lastErr = new Error(`Gemini ${code ?? "error"}: ${message}`);
        log("warn", `${model} → ${code ?? "error"}: ${message}`);
        if (code === 400 || code === 404) {
          dead.add(model); // retired or rejected for every key
          continue modelLoop;
        }
        if (code === 503) continue modelLoop; // model-wide overload; retried next pass
        if (code === 401 || code === 403 || code === 429 || (code !== null && code >= 500)) continue; // try next key
        throw lastErr;
      }
    }
  }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All Gemini models/keys failed");
}
