import { KeyRound } from "lucide-react";
import { curatedGuides } from "@/data/curated";
import { Dashboard } from "@/components/Dashboard";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <nav className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2 font-mono text-sm text-zinc-300">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
            <KeyRound className="h-3.5 w-3.5 text-zinc-300" />
          </span>
          oauth<span className="text-zinc-600">/</span>readiness
        </div>
        <span className="font-mono text-xs text-zinc-500">{curatedGuides.length} curated guides</span>
      </nav>

      <section className="pb-8 pt-10 sm:pt-16">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Know what stands between your agent and production OAuth.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Review walls, admin approvals, security audits, and realistic timelines for each provider, with every
          claim labeled by its evidence.
        </p>
      </section>

      <Dashboard guides={curatedGuides} />
    </main>
  );
}
