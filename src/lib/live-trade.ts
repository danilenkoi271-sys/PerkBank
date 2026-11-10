// Presentation-only "live" investment values. These never touch balances; the
// real outcome is decided by the admin and settled in the database.

export type LiveOrder = { id: string; amount: number; multiplier: number; status: string };

export const SETTLE_SUCCESS_MS = 20000;
export const SETTLE_FAIL_MS = 25000;

function seed(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

/** Smoothly wandering value of a pending order, always between 0 and the full payout. */
export function pendingValue(order: LiveOrder, nowMs: number) {
  const s = seed(order.id) * Math.PI * 2;
  const t = nowMs / 1000;
  const wave = (Math.sin(t / 6.1 + s) * 0.55 + Math.sin(t / 2.3 + s * 2) * 0.3 + Math.sin(t / 13.7 + s * 3) * 0.45) / 1.3;
  const amplitude = 0.04 + 0.12 * (order.multiplier - 1);
  return clamp(order.amount * (1 + amplitude * wave), 0, order.amount * order.multiplier);
}

export function settleTarget(order: LiveOrder) {
  return order.status === 'success' ? round2(order.amount * order.multiplier) : 0;
}

export function settleDuration(order: LiveOrder) {
  return order.status === 'success' ? SETTLE_SUCCESS_MS : SETTLE_FAIL_MS;
}

/** Glide from the value at the moment of settlement to the final outcome, with jitter that fades out. */
export function settlingValue(order: LiveOrder, startedAtMs: number, nowMs: number) {
  const start = pendingValue(order, startedAtMs);
  const target = settleTarget(order);
  const p = clamp((nowMs - startedAtMs) / settleDuration(order), 0, 1);
  if (p >= 1) return target;
  const eased = order.status === 'success' ? 1 - Math.pow(1 - p, 2.2) : p * p * (3 - 2 * p);
  const jitter = Math.sin(nowMs / 420 + seed(order.id) * 9) * order.amount * 0.03 * (1 - p);
  return clamp(start + (target - start) * eased + jitter, 0, order.amount * order.multiplier);
}

export function liveChange(order: LiveOrder, value: number) {
  const diff = value - order.amount;
  return { diff, percent: order.amount > 0 ? (diff / order.amount) * 100 : 0, up: diff >= 0 };
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function round2(v: number) { return Math.round(v * 100) / 100; }
