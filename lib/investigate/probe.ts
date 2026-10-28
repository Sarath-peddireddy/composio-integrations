import type { ProbeAttempt } from "@/types/oauth";
import { isSafePublicHost } from "@/lib/domain";

const PROBE_TIMEOUT_MS = 2500;
const MAX_BODY_BYTES = 256 * 1024;

export const DISCOVERY_PATHS = [
  "/.well-known/openid-configuration", // OpenID Connect Discovery 1.0
  "/.well-known/oauth-authorization-server", // RFC 8414
] as const;

/** Only the fields we trust from a discovery document. */
export interface DiscoveryDoc {
  sourceUrl: string;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  revocation_endpoint?: string;
  userinfo_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
}

export interface ProbeResult {
  attempts: ProbeAttempt[];
  /** First valid discovery document found, if any. */
  discovery: DiscoveryDoc | null;
}

const str = (v: unknown) => (typeof v === "string" && v.startsWith("https://") ? v : undefined);
const strArr = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 200) : undefined;

/**
 * Fetch one URL, following at most 2 redirects manually so every hop goes
 * through the SSRF host check. Never throws.
 */
async function fetchJson(url: string): Promise<{ attempt: ProbeAttempt; body?: unknown }> {
  let current = url;
  try {
    for (let hop = 0; hop <= 2; hop++) {
      const host = new URL(current).hostname;
      if (!isSafePublicHost(host)) {
        return { attempt: { url, status: null, ok: false, note: `Blocked non-public host ${host}` } };
      }
      const res = await fetch(current, {
        redirect: "manual",
        headers: { Accept: "application/json", "User-Agent": "oauth-readiness-probe/1.0" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current).toString();
        if (!current.startsWith("https://")) {
          return { attempt: { url, status: res.status, ok: false, note: "Redirected to non-HTTPS URL" } };
        }
        continue;
      }
      const note = current !== url ? `Redirected to ${current}` : undefined;
      if (!res.ok) return { attempt: { url, status: res.status, ok: false, note } };

      const text = await res.text();
      if (text.length > MAX_BODY_BYTES) {
        return { attempt: { url, status: res.status, ok: false, note: "Response too large" } };
      }
      try {
        return { attempt: { url, status: res.status, ok: true, note }, body: JSON.parse(text) };
      } catch {
        return { attempt: { url, status: res.status, ok: false, note: "200 but not JSON (likely an HTML page)" } };
      }
    }
    return { attempt: { url, status: null, ok: false, note: "Too many redirects" } };
  } catch (err) {
    const e = err as Error;
    const note = e.name === "TimeoutError" ? `Timed out after ${PROBE_TIMEOUT_MS}ms` : `Network error: ${e.message}`;
    return { attempt: { url, status: null, ok: false, note } };
  }
}

/** Tier 1: deterministic RFC 8414 / OIDC discovery probe. Never throws. */
export async function probeDiscovery(domain: string): Promise<ProbeResult> {
  const urls = DISCOVERY_PATHS.map((p) => `https://${domain}${p}`);
  const results = await Promise.all(urls.map(fetchJson));

  let discovery: DiscoveryDoc | null = null;
  const attempts = results.map(({ attempt, body }) => {
    if (!attempt.ok || !body || typeof body !== "object") return attempt;
    const b = body as Record<string, unknown>;
    const doc: DiscoveryDoc = {
      sourceUrl: attempt.url,
      issuer: str(b.issuer),
      authorization_endpoint: str(b.authorization_endpoint),
      token_endpoint: str(b.token_endpoint),
      revocation_endpoint: str(b.revocation_endpoint),
      userinfo_endpoint: str(b.userinfo_endpoint),
      scopes_supported: strArr(b.scopes_supported),
      code_challenge_methods_supported: strArr(b.code_challenge_methods_supported),
      grant_types_supported: strArr(b.grant_types_supported),
    };
    // A real discovery doc must name at least an authorization or token endpoint.
    if (!doc.authorization_endpoint && !doc.token_endpoint) {
      return { ...attempt, ok: false, note: "JSON returned but no OAuth endpoints in it" };
    }
    discovery ??= doc;
    return attempt;
  });

  return { attempts, discovery };
}
