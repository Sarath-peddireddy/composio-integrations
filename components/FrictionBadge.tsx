import type { FrictionTier } from "@/types/oauth";
import { TIER_META } from "@/lib/friction";

export function FrictionBadge({ tier }: { tier: FrictionTier }) {
  const meta = TIER_META[tier];
  return (
    <span
      title={tier}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.short}
    </span>
  );
}

/** Three-segment bar: how much friction stands between dev and production. */
export function FrictionMeter({ tier }: { tier: FrictionTier }) {
  const meta = TIER_META[tier];
  return (
    <div className="flex gap-1" aria-label={`Friction level ${meta.level} of 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full ${i <= meta.level ? meta.meter : "bg-zinc-800"}`}
        />
      ))}
    </div>
  );
}
