import type { InvestigationEvent } from "@/types/oauth";
import { getCuratedGuideByDomain } from "@/data/curated";
import { isSafePublicHost, toDomain } from "@/lib/domain";
import { probeDiscovery } from "@/lib/investigate/probe";
import { crawlDocs } from "@/lib/investigate/crawl";
import { synthesizeGuide } from "@/lib/investigate/synthesize";
import { finalizeGuide } from "@/lib/investigate/finalize";
import { getCached, setCached } from "@/lib/investigate/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/investigate  { "domain": "notion.so", "refresh"?: boolean }
 *
 * Streams NDJSON InvestigationEvents (one JSON object per line) so the UI can
 * show each pipeline tier as it runs. The last line is a "result" or "error".
 */
export async function POST(req: Request) {
  let body: { domain?: unknown; refresh?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON: { \"domain\": \"example.com\" }" }, { status: 400 });
  }

  const domain = typeof body.domain === "string" ? toDomain(body.domain) : null;
  if (!domain) return Response.json({ error: "Provide a valid app domain, e.g. notion.so" }, { status: 400 });
  if (!isSafePublicHost(domain)) return Response.json({ error: `Refusing to probe non-public host ${domain}` }, { status: 400 });
  const refresh = body.refresh === true;

  const encoder = new TextEncoder();
  let clientGone = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      clientGone = true;
    },
    async start(controller) {
      const send = (evt: InvestigationEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(evt) + "\n"));
        } catch {
          clientGone = true;
        }
      };
      const logger = (tier: 0 | 1 | 2 | 3) => (status: "run" | "ok" | "warn" | "fail", message: string) =>
        send({ type: "step", tier, status, message });

      try {
        // Fast path: curated guides skip all external calls (ARCHITECTURE.md §5.2).
        const curated = getCuratedGuideByDomain(domain);
        if (curated) {
          logger(0)("ok", `${domain} matches curated guide "${curated.provider}". Skipping live pipeline.`);
          send({ type: "result", guide: curated, cached: true });
          return;
        }
        const cached = !refresh && getCached(domain);
        if (cached) {
          logger(0)("ok", `Serving guide generated at ${cached.investigation?.generatedAt ?? "earlier"} (cache)`);
          send({ type: "result", guide: cached, cached: true });
          return;
        }
        logger(0)("ok", `No curated guide for ${domain}. Starting live investigation.`);

        // Tier 1: deterministic discovery probe.
        const t1 = logger(1);
        t1("run", `GET https://${domain}/.well-known/{openid-configuration, oauth-authorization-server} (2500ms timeout)`);
        const probe = await probeDiscovery(domain);
        for (const a of probe.attempts) {
          t1(a.ok ? "ok" : "warn", `${a.status ?? "ERR"} ${a.url}${a.note ? ` (${a.note})` : ""}`);
        }
        if (probe.discovery) {
          t1("ok", `authorization_endpoint=${probe.discovery.authorization_endpoint ?? "?"}`);
          t1("ok", `token_endpoint=${probe.discovery.token_endpoint ?? "?"}`);
        } else {
          t1("warn", "No discovery document. Endpoints must come from docs.");
        }
        const probeSummary = probe.attempts.map((a) => `${a.url} → ${a.status ?? "no response"}${a.note ? ` (${a.note})` : ""}`).join("\n");

        // Tier 2: policy and doc crawl.
        const crawl = await crawlDocs(domain, domain.split(".").slice(-2, -1)[0] ?? domain, logger(2), {
          needEndpoints: !probe.discovery,
        });
        for (const d of crawl.docs) logger(2)("ok", `source ${d.url}`);

        // Don't spend LLM quota if the viewer already left.
        if (clientGone || req.signal.aborted) return;

        // Nothing to ground a guide in: refuse rather than let the model invent one.
        if (!probe.discovery && crawl.docs.length === 0) {
          logger(3)("fail", "No discovery document and no OAuth documentation found. Skipping synthesis.");
          send({
            type: "error",
            message: `Found no OAuth evidence for ${domain}. Check the spelling, or try the provider's main or developer domain (e.g. notion.com instead of notion.site).`,
          });
          return;
        }

        // Tier 3: LLM synthesis plus server-side audit of the model's claims.
        const t3 = logger(3);
        const { guide: raw, model } = await synthesizeGuide(domain, probe.discovery, probeSummary, crawl.docs, crawl.corpus, t3);
        const guide = finalizeGuide({
          domain,
          model,
          raw,
          probes: probe.attempts,
          discovery: probe.discovery,
          docs: crawl.docs,
          corpus: crawl.corpus,
        });
        const rejected = guide.investigation?.rejectedClaims.length ?? 0;
        t3(rejected ? "warn" : "ok", rejected ? `Audit rejected ${rejected} unsupported claim(s)` : "Audit: every endpoint and source traced to evidence");
        t3("ok", `Tier: ${guide.frictionTier} · confidence ${guide.confidence.status}`);

        setCached(domain, guide);
        send({ type: "result", guide });
      } catch (err) {
        send({ type: "error", message: (err as Error)?.message ?? "Investigation failed" });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
