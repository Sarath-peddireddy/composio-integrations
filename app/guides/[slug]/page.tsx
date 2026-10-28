import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCuratedGuide, getCuratedGuideByDomain } from "@/data/curated";
import { isSafePublicHost, toDomain } from "@/lib/domain";
import { getCached } from "@/lib/investigate/cache";
import { GuideView } from "@/components/guide/GuideView";
import { LiveInvestigation } from "@/components/guide/LiveInvestigation";

type Props = { params: Promise<{ slug: string }> };

/** Curated slug ("slack"), curated domain ("slack.com"), or any public domain to investigate. */
function resolve(slugParam: string) {
  const slug = decodeURIComponent(slugParam).toLowerCase();
  const curated = getCuratedGuide(slug);
  if (curated) return { curated };
  const domain = toDomain(slug);
  if (!domain || !isSafePublicHost(domain)) return null;
  const byDomain = getCuratedGuideByDomain(domain);
  return byDomain ? { curated: byDomain } : { domain };
}

// Dynamic so live guides can be served from the server-side cache on shared links.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = resolve((await params).slug);
  if (!r) return { title: "Guide not found · OAuth Readiness" };
  if (r.curated) {
    return {
      title: `${r.curated.provider} OAuth guide · OAuth Readiness`,
      description: `${r.curated.frictionTier}. Dev: ${r.curated.timeToDev}, production: ${r.curated.timeToProduction}.`,
    };
  }
  return { title: `${r.domain} OAuth guide · OAuth Readiness` };
}

export default async function GuidePage({ params }: Props) {
  const r = resolve((await params).slug);
  if (!r) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      {r.curated ? (
        <GuideView guide={r.curated} />
      ) : (
        // A previously generated guide renders instantly from the server cache (shared links).
        <LiveInvestigation domain={r.domain} initialGuide={getCached(r.domain)} />
      )}
    </main>
  );
}
