const UNIT_HOURS: [RegExp, number][] = [
  [/^min/, 1 / 60],
  [/^(hour|hr)/, 1],
  [/^(business day|day)/, 24],
  [/^(week|wk)/, 168],
  [/^(month|mo)/, 720],
];

const RANGE_RE =
  /(\d+(?:\.\d+)?)(?:\s*\+)?(?:\s*(?:–|—|-|to)\s*(\d+(?:\.\d+)?)(?:\s*\+)?)?\s*(minutes?|mins?|hours?|hrs?|business days?|days?|weeks?|wks?|months?|mos?)\b/gi;

/**
 * Best-effort parse of human time estimates ("5 minutes", "2 – 12+ weeks",
 * "1 day – 6+ weeks", "Same day") into an hour range. Returns null if unparseable.
 */
export function parseDurationRange(input: string): { min: number; max: number } | null {
  const s = input.toLowerCase();
  const values: number[] = [];
  if (/same day|today/.test(s)) values.push(8);
  if (/instant|immediate/.test(s)) values.push(0.05);
  for (const m of s.matchAll(RANGE_RE)) {
    const unit = UNIT_HOURS.find(([re]) => re.test(m[3]))?.[1] ?? 1;
    values.push(Number(m[1]) * unit);
    if (m[2]) values.push(Number(m[2]) * unit);
  }
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Log-scale position (0–1) between 1 minute and 6 months. */
export const GAUGE_MIN_H = 1 / 60;
export const GAUGE_MAX_H = 24 * 30 * 6;
export function gaugePosition(hours: number): number {
  const clamped = Math.min(Math.max(hours, GAUGE_MIN_H), GAUGE_MAX_H);
  return Math.log(clamped / GAUGE_MIN_H) / Math.log(GAUGE_MAX_H / GAUGE_MIN_H);
}

export const GAUGE_TICKS: { label: string; hours: number }[] = [
  { label: "1m", hours: 1 / 60 },
  { label: "1h", hours: 1 },
  { label: "1d", hours: 24 },
  { label: "1w", hours: 168 },
  { label: "1mo", hours: 720 },
  { label: "6mo", hours: GAUGE_MAX_H },
];
