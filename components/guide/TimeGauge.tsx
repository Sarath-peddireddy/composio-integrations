import type { FrictionTier } from "@/types/oauth";
import { TIER_META } from "@/lib/friction";
import { GAUGE_TICKS, gaugePosition, parseDurationRange } from "@/lib/duration";

function Row({ label, value, range, barClass }: { label: string; value: string; range: { min: number; max: number } | null; barClass: string }) {
  const start = range ? gaugePosition(range.min) : 0;
  const end = range ? gaugePosition(range.max) : 0;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
        <div className="text-sm font-medium text-zinc-100">{value}</div>
      </div>
      <div className="relative h-2.5 rounded-full bg-zinc-800/80">
        {range && (
          <>
            {/* faint lead-in from zero, solid segment for the estimated range */}
            <div className="absolute inset-y-0 left-0 rounded-full bg-zinc-700/40" style={{ width: `${end * 100}%` }} />
            <div
              className={`absolute inset-y-0 rounded-full ${barClass}`}
              style={{ left: `${start * 100}%`, width: `${Math.max(end - start, 0.012) * 100}%` }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Log-scale comparison of time-to-dev vs. time-to-production. */
export function TimeGauge({ timeToDev, timeToProduction, tier }: { timeToDev: string; timeToProduction: string; tier: FrictionTier }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <div className="space-y-4">
        <Row label="Dev ready" value={timeToDev} range={parseDurationRange(timeToDev)} barClass="bg-zinc-300" />
        <Row label="Production" value={timeToProduction} range={parseDurationRange(timeToProduction)} barClass={TIER_META[tier].meter} />
      </div>
      <div className="mt-2 grid grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr]">
        <span />
        <div className="relative h-4 font-mono text-[10px] text-zinc-600">
          {GAUGE_TICKS.map((t, i) => (
            <span
              key={t.label}
              className="absolute"
              style={{
                left: `${gaugePosition(t.hours) * 100}%`,
                transform: i === 0 ? "none" : i === GAUGE_TICKS.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
