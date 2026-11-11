// Presentation-only "live" investment values. These never touch balances; the
// real outcome is decided by the admin and settled in the database.

export type LiveOrder = { id: string; amount: number; multiplier: number; status: string; created_at?: string | null };

export const SETTLE_SUCCESS_MS = 55000;
export const SETTLE_FAIL_MS = 65000;

function seed(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function hash(i: number, s: number) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
const ease = (f: number) => { const s = f * f * (3 - 2 * f); return s * s * (3 - 2 * s); };
/** Value noise that rests on a level for a moment, then moves: gives the line its small stalls and ticks. */
function ticks(tSec: number, s: number) {
  const g = tSec / 6; const i = Math.floor(g); const a = hash(i, s); const b = hash(i + 1, s);
  return a + (b - a) * ease(g - i);
}
// Now and then the price simply holds still for a few seconds. Time is "paused" during those stalls, so the wander
// resumes exactly where it stopped. Stalls are seeded per order and counted from the moment the trade goes live.
const STALL_PERIOD_MS = 22_000;
const stallCache = new Map<string, number[]>();
function stallPeriod(order: LiveOrder, k: number) {
  const r = rng((Math.floor(seed(order.id) * 4294967295) ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
  const len = r() < 0.45 ? 3000 + r() * 7000 : 0;
  return { start: r() * (STALL_PERIOD_MS - len), len };
}
function stalledBefore(order: LiveOrder, relMs: number) {
  if (relMs <= 0) return 0;
  const k = Math.floor(relMs / STALL_PERIOD_MS);
  let prefix = stallCache.get(order.id);
  if (!prefix) { prefix = [0]; stallCache.set(order.id, prefix); if (stallCache.size > 50) stallCache.delete(stallCache.keys().next().value as string); }
  while (prefix.length <= k) prefix.push((prefix[prefix.length - 1] as number) + stallPeriod(order, prefix.length - 1).len);
  const { start, len } = stallPeriod(order, k);
  return (prefix[k] as number) + clamp(relMs - k * STALL_PERIOD_MS - start, 0, len);
}
function wave(order: LiveOrder, tMs: number) {
  const s = seed(order.id) * Math.PI * 2;
  const fill = fillTime(order);
  const t = (Number.isFinite(fill) ? tMs - stalledBefore(order, tMs - fill) : tMs) / 1000;
  return (Math.sin(t / 24 + s) * 0.55 + Math.sin(t / 10 + s * 2) * 0.3 + Math.sin(t / 52 + s * 3) * 0.45) / 1.3 + ticks(t, s) * 0.12;
}

/**
 * Smoothly wandering value of a pending order, always between 0 and the full payout. It is a pure function of the
 * order and the clock, so every device shows the same value. With created_at it starts at exactly the stake.
 */
export function pendingValue(order: LiveOrder, nowMs: number) {
  const fill = fillTime(order);
  const base = Number.isFinite(fill) ? wave(order, fill) : 0;
  const t = Number.isFinite(fill) ? Math.max(nowMs, fill) : nowMs;
  const amplitude = 0.04 + 0.12 * (order.multiplier - 1);
  return clamp(order.amount * (1 + amplitude * (wave(order, t) - base)), 0, order.amount * order.multiplier);
}

/** Before a trade goes live it is "prepared" for 10 to 30 seconds. The length comes from the order id, so every device agrees. */
export const PREP_MIN_MS = 10_000;
export const PREP_MAX_MS = 30_000;
export const prepDuration = (order: LiveOrder) => Math.round(PREP_MIN_MS + seed(order.id) * (PREP_MAX_MS - PREP_MIN_MS));
/** The moment the trade goes live: placement time plus the preparation phase. NaN when the order has no timestamp. */
export function fillTime(order: LiveOrder) {
  const created = order.created_at ? Date.parse(order.created_at) : NaN;
  return Number.isFinite(created) ? created + prepDuration(order) : NaN;
}
export function isPreparing(order: LiveOrder, nowMs: number) {
  const fill = fillTime(order);
  return order.status === 'pending' && Number.isFinite(fill) && nowMs < fill;
}

const PREP_STEPS = [
  { work: 'Searching coins', done: 'Coin found' },
  { work: 'Checking volume', done: 'Volume confirmed' },
  { work: 'Checking market cap', done: 'Market cap checked' },
  { work: 'Estimating', done: 'Estimate ready' },
  { work: 'Calculating', done: 'Calculations done' },
  { work: 'Placing order', done: 'Order placed' },
];
/**
 * What the "thinking" pill shows at a given moment: each step works for a while, then briefly confirms it is done
 * before the next one starts. Shorter waits skip a step or two; the last step is always placing the order.
 */
/** Per-trade pacing for the steps: coin search is never very short and often much longer, the rest vary a little. */
function prepWeights(order: LiveOrder, picks: number[]) {
  const r = rng((Math.floor(seed(order.id) * 4294967295) ^ 0x2c1b3c6d) >>> 0);
  const longSearch = r() < 0.3;
  return picks.map((step, i) => {
    const jitter = r();
    if (step === 0) return longSearch ? 3.5 + jitter * 2.5 : 1.6 + jitter * 1.4;
    if (i === picks.length - 1) return 0.9 + jitter;
    return 0.7 + jitter * 1.1;
  });
}

export function prepStage(order: LiveOrder, elapsedMs: number): { label: string; done: boolean } {
  const total = prepDuration(order);
  const picks = total < 13_000 ? [0, 1, 4, 5] : total < 19_000 ? [0, 1, 2, 4, 5] : [0, 1, 2, 3, 4, 5];
  const weights = prepWeights(order, picks);
  const sum = weights.reduce((a, b) => a + b, 0);
  let start = 0;
  for (let i = 0; i < picks.length; i++) {
    const slot = ((weights[i] as number) / sum) * total;
    const end = start + slot;
    if (elapsedMs < end) {
      const step = PREP_STEPS[picks[i] as number] as { work: string; done: string };
      const doneFor = Math.min(slot * 0.5, Math.max(700, Math.min(1500, slot * 0.28)));
      return elapsedMs >= end - doneFor ? { label: step.done, done: true } : { label: step.work, done: false };
    }
    start = end;
  }
  return { label: (PREP_STEPS[5] as { done: string }).done, done: true };
}

export function settleTarget(order: LiveOrder) {
  return order.status === 'success' ? round2(order.amount * order.multiplier) : 0;
}

export function settleDuration(order: LiveOrder) {
  return order.status === 'success' ? SETTLE_SUCCESS_MS : SETTLE_FAIL_MS;
}

function rng(n: number) {
  let a = n >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type Leg = { t: number; level: number };
/**
 * A scripted route from the current value to the outcome, as fractions: level 0 is where the price was when the
 * trade was settled and level 1 is the final result. It is made of surges, pauses and small pullbacks in an order
 * that is different for every order, always finishing on a surge so the last move lands on the outcome.
 */
const routes = new Map<string, Leg[]>();
function route(order: LiveOrder): Leg[] {
  const key = `${order.id}:${order.status}`; const hit = routes.get(key); if (hit) return hit;
  const legs = buildRoute(order); routes.set(key, legs); if (routes.size > 50) routes.delete(routes.keys().next().value as string); return legs;
}
function buildRoute(order: LiveOrder): Leg[] {
  const r = rng(Math.floor(seed(order.id) * 4294967295) ^ (order.status === 'success' ? 0x9e3779b9 : 0x85ebca6b));
  const kinds = ['surge', 'surge', 'surge', 'range', 'range', 'dip', 'dip'];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j] as string, kinds[i] as string]; }
  if (kinds[kinds.length - 1] !== 'surge') { const k = kinds.lastIndexOf('surge'); [kinds[k], kinds[kinds.length - 1]] = [kinds[kinds.length - 1] as string, kinds[k] as string]; }
  const raw: { dt: number; dl: number }[] = kinds.map(kind => kind === 'surge' ? { dt: 0.9 + r() * 0.6, dl: 0.2 + r() * 0.14 } : kind === 'range' ? { dt: 1.2 + r() * 0.8, dl: (r() - 0.4) * 0.05 } : { dt: 0.6 + r() * 0.4, dl: -(0.07 + r() * 0.06) });
  const totalT = raw.reduce((a, x) => a + x.dt, 0); const totalL = raw.reduce((a, x) => a + x.dl, 0);
  const legs: Leg[] = [{ t: 0, level: 0 }]; let t = 0; let level = 0;
  raw.forEach((x, i) => { t += x.dt / totalT; level += x.dl / totalL; legs.push({ t: i === raw.length - 1 ? 1 : t, level: i === raw.length - 1 ? 1 : Math.min(0.97, level) }); });
  return legs;
}

function routeLevel(legs: Leg[], p: number) {
  for (let i = 1; i < legs.length; i++) {
    const a = legs[i - 1] as Leg; const b = legs[i] as Leg;
    if (p <= b.t) {
      const u = (p - a.t) / (b.t - a.t || 1);
      const rising = b.level > a.level + 0.1; // surges move fast then settle; everything else moves gently
      const e = rising ? 1 - Math.pow(1 - u, 2.4) : u * u * (3 - 2 * u);
      return a.level + (b.level - a.level) * e;
    }
  }
  return 1;
}

/** Progress through the final move with a couple of pauses in it; the pauses are seeded per order. */
function glideProgress(order: LiveOrder, p: number) {
  const r = rng((Math.floor(seed(order.id) * 4294967295) ^ 0x51ed270b) >>> 0);
  const a1 = 0.18 + r() * 0.2; const l1 = 0.04 + r() * 0.05;
  const a2 = 0.55 + r() * 0.2; const l2 = 0.04 + r() * 0.05;
  return (p - clamp(p - a1, 0, l1) - clamp(p - a2, 0, l2)) / (1 - l1 - l2);
}

/** Moves from the value at the moment of settlement to the final outcome along a unique, natural-looking route. */
export function settlingValue(order: LiveOrder, startedAtMs: number, nowMs: number) {
  const start = pendingValue(order, startedAtMs);
  const target = settleTarget(order);
  const p = clamp((nowMs - startedAtMs) / settleDuration(order), 0, 1);
  if (p >= 1) return target;
  const pe = glideProgress(order, p); // frozen while the price pauses
  const noise = ticks((startedAtMs + pe * settleDuration(order)) / 1000, seed(order.id) * 7) * order.amount * 0.01 * Math.min(1, pe * 10) * (1 - pe);
  return clamp(start + (target - start) * routeLevel(route(order), pe) + noise, 0, order.amount * order.multiplier);
}

export function liveChange(order: LiveOrder, value: number) {
  const diff = value - order.amount;
  return { diff, percent: order.amount > 0 ? (diff / order.amount) * 100 : 0, up: diff >= 0 };
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function round2(v: number) { return Math.round(v * 100) / 100; }

/**
 * A trade is in progress while it is pending, or until its chart has finished playing the result. Only one is allowed
 * at a time. `graceMs` lets the server accept a request that arrives right as the chart finishes on the user's screen.
 */
export function hasActiveTrade(orders: { status: string; settled_at?: string | null }[], nowMs: number, graceMs = 0) {
  return orders.some(o => {
    if (o.status === 'pending') return true;
    const at = o.settled_at ? Date.parse(o.settled_at) : NaN;
    return Number.isFinite(at) && nowMs < at + settleDuration({ id: '', amount: 0, multiplier: 0, status: o.status }) - graceMs;
  });
}
