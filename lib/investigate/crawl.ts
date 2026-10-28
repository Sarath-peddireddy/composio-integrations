import type { SourceRef } from "@/types/oauth";

/** ARCHITECTURE.md §5: cap docs passed to the model to prevent token bloat. */
export const MAX_CORPUS_CHARS = 12_000;
const MIN_USEFUL_CHARS = 3_000;
const MAX_DOCS = 6;

export interface CrawledDoc extends SourceRef {
  markdown: string;
}

export interface CrawlResult {
  docs: CrawledDoc[];
  /** Concatenated, truncated markdown handed to the model. */
  corpus: string;
}

type Log = (status: "run" | "ok" | "warn" | "fail", message: string) => void;

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
}

async function tavilySearch(apiKey: string, query: string, includeDomains?: string[]): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: 8,
      include_raw_content: "markdown",
      ...(includeDomains ? { include_domains: includeDomains } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

async function firecrawlScrape(apiKey: string, url: string): Promise<string | null> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Firecrawl HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { markdown?: string } };
  return json.data?.markdown ?? null;
}

/** Collapse whitespace and drop image/link noise so the char budget holds real text. */
function clean(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Words that signal a passage is about OAuth setup, scopes, or review gates. */
const SIGNAL =
  /oauth|authoriz|client[_ ]id|client[_ ]secret|redirect|callback|scope|token|pkce|consent|verif|review|approv|audit|security assessment|marketplace|publish|distribut|admin|install/gi;

const relevance = (text: string) => (text.match(SIGNAL) ?? []).length;

/** Keep the most OAuth-relevant passages of a page (in original order) within a char budget. */
function excerpt(md: string, budget: number): string {
  if (md.length <= budget) return md;
  const blocks = md.split(/\n{2,}/).map((text, i) => ({ text, i, score: relevance(text) / Math.sqrt(text.length + 40) }));
  const picked = new Set<number>();
  let used = 0;
  for (const b of [...blocks].sort((a, z) => z.score - a.score)) {
    if (b.score === 0 || used + b.text.length > budget) continue;
    picked.add(b.i);
    used += b.text.length + 2;
  }
  return blocks.filter((b) => picked.has(b.i)).map((b) => b.text).join("\n\n") || md.slice(0, budget);
}

function buildCorpus(docs: CrawledDoc[]): string {
  if (!docs.length) return "";
  const perDoc = Math.floor(MAX_CORPUS_CHARS / docs.length) - 150;
  return docs
    .map((d, i) => `### [S${i + 1}] ${d.title}\nURL: ${d.url}\n\n${excerpt(d.markdown, perDoc)}`)
    .join("\n\n---\n\n")
    .slice(0, MAX_CORPUS_CHARS);
}

/** Tier 2: find and extract the provider's OAuth / app-review docs. Never throws. */
export async function crawlDocs(
  domain: string,
  provider: string,
  log: Log,
  opts: { needEndpoints: boolean } = { needEndpoints: true },
): Promise<CrawlResult> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const seen = new Map<string, CrawledDoc>();

  // Off-site results must be about THIS provider. Generic OAuth pages from other
  // companies (Google, Figma...) would otherwise leak into the guide.
  const label = provider.toLowerCase();
  const aboutProvider = (r: TavilyResult) => {
    let host = "";
    try {
      host = new URL(r.url!).hostname;
    } catch {}
    if (host === domain || host.endsWith(`.${domain}`)) return true;
    if (label.length < 3) return (r.raw_content || r.content || "").toLowerCase().includes(domain);
    return host.includes(label) || (r.title ?? "").toLowerCase().includes(label);
  };

  const add = (results: TavilyResult[]) => {
    for (const r of results) {
      if (!r.url || seen.has(r.url) || seen.size >= MAX_DOCS || !aboutProvider(r)) continue;
      const markdown = clean(r.raw_content || r.content || "");
      // Drop pages that never mention OAuth concepts (e.g. unrelated help articles).
      if (markdown.length < 200 || !/oauth|authoriz|client[_ ]id|redirect[_ ]ur/i.test(markdown)) continue;
      seen.set(r.url, { title: r.title?.trim() || r.url, url: r.url, markdown });
    }
  };

  if (!tavilyKey) {
    log("warn", "TAVILY_API_KEY not set. Skipping doc crawl.");
  } else {
    const siteQuery = `site:${domain} "create oauth app" OR "app review" OR "scopes"`;
    log("run", `tavily.search ${siteQuery}`);
    try {
      add(await tavilySearch(tavilyKey, siteQuery, [domain]));
      log(seen.size ? "ok" : "warn", `${seen.size} page(s) on ${domain}`);
    } catch (e) {
      log("fail", (e as Error).message);
    }

    // Many providers host developer docs on a different domain (slack.com → docs.slack.dev).
    // Also widen the search when the probe found no endpoints and the docs don't show any either.
    const endpointHints = [...seen.values()].some((d) => /https:\/\/\S*(authorize|oauth|\/token)/i.test(d.markdown));
    if (seen.size < 2 || (opts.needEndpoints && !endpointHints)) {
      const broadQuery = `${provider} (${domain}) OAuth app registration scopes app review verification developer documentation`;
      log("run", `tavily.search ${broadQuery}`);
      try {
        add(await tavilySearch(tavilyKey, broadQuery));
        log(seen.size ? "ok" : "warn", `${seen.size} page(s) total after broad search`);
      } catch (e) {
        log("fail", (e as Error).message);
      }
    }
  }

  let docs = [...seen.values()].sort((a, z) => relevance(z.markdown) - relevance(a.markdown));
  const chars = docs.reduce((n, d) => n + d.markdown.length, 0);

  // Deep extraction fallback: search snippets alone are too thin to reason about review rules.
  if (firecrawlKey && docs.length && chars < MIN_USEFUL_CHARS) {
    const target = docs[0];
    log("run", `firecrawl.scrape ${target.url}`);
    try {
      const md = await firecrawlScrape(firecrawlKey, target.url);
      if (md) {
        docs = [{ ...target, markdown: clean(md) }, ...docs.slice(1)];
        log("ok", `Extracted ${md.length.toLocaleString()} chars of markdown`);
      } else {
        log("warn", "Firecrawl returned no markdown");
      }
    } catch (e) {
      log("fail", (e as Error).message);
    }
  }

  const corpus = buildCorpus(docs);
  log(docs.length ? "ok" : "warn", `Corpus: ${docs.length} source(s), ${corpus.length.toLocaleString()} chars (cap ${MAX_CORPUS_CHARS.toLocaleString()})`);
  return { docs, corpus };
}
