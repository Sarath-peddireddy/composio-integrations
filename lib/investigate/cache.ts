import type { OAuthGuideSpec } from "@/types/oauth";

const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * In-memory cache so a shared /guides/{domain} link doesn't re-run the whole
 * pipeline on every view. Per server instance only; resets on redeploy.
 */
const store: Map<string, { guide: OAuthGuideSpec; at: number }> =
  ((globalThis as Record<string, unknown>).__guideCache as Map<string, { guide: OAuthGuideSpec; at: number }>) ??
  new Map();
(globalThis as Record<string, unknown>).__guideCache = store;

export function getCached(domain: string): OAuthGuideSpec | undefined {
  const hit = store.get(domain);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(domain);
    return undefined;
  }
  return hit.guide;
}

export function setCached(domain: string, guide: OAuthGuideSpec) {
  store.set(domain, { guide, at: Date.now() });
}
