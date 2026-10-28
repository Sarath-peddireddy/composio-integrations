/**
 * Turn user input like "https://www.Notion.so/integrations" into "notion.so".
 * Returns null when the input is not hostname-shaped (plain search text).
 */
export function toDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw || /\s/.test(raw)) return null;
  const host = raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#:]/)[0];
  if (host.length > 253) return null;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host) ? host : null;
}

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".test", ".invalid", ".example"];

/**
 * SSRF guard: the server fetches URLs built from user input, so only allow
 * public-looking hostnames. Rejects IP literals, localhost and private TLDs.
 * (Does not defend against DNS rebinding; acceptable for this prototype.)
 */
export function isSafePublicHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false; // IPv4 literal
  if (h.includes(":") || h.startsWith("[")) return false; // IPv6 literal
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return false;
  const tld = h.split(".").pop() ?? "";
  return /^[a-z]{2,63}$/.test(tld) || /^xn--[a-z0-9-]+$/.test(tld);
}
