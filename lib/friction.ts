import type { FrictionTier } from "@/types/oauth";

export interface TierMeta {
  /** Short label for chips and badges. */
  short: string;
  /** 1 = least friction, 3 = most. Drives the meter on cards. */
  level: 1 | 2 | 3;
  badge: string;
  dot: string;
  meter: string;
}

export const TIER_META: Record<FrictionTier, TierMeta> = {
  "Instant (Zero Review)": {
    short: "Instant",
    level: 1,
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
    meter: "bg-emerald-400",
  },
  "Tenant Gated (Admin Approval)": {
    short: "Tenant Gated",
    level: 2,
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
    meter: "bg-amber-400",
  },
  "Review Wall (Audit/Verification)": {
    short: "Review Wall",
    level: 3,
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
    meter: "bg-rose-400",
  },
};
