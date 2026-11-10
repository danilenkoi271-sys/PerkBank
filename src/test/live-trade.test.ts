import { describe, expect, it } from 'vitest';
import { fillTime, hasActiveTrade, isPreparing, pendingValue, prepDuration, prepStage, settlingValue, SETTLE_FAIL_MS, SETTLE_SUCCESS_MS, TRADE_LOCK_MS } from '@/lib/live-trade';

const order = { id: 'abc-123', amount: 100, multiplier: 2, status: 'pending' };

describe('live investment values', () => {
  it('pending value moves but stays between 0 and the full payout', () => {
    const values = Array.from({ length: 200 }, (_, i) => pendingValue(order, i * 1000));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(200);
    expect(new Set(values.map(v => v.toFixed(2))).size).toBeGreaterThan(50);
  });
  it('approved investment climbs to stake times multiplier', () => {
    const won = { ...order, status: 'success' };
    expect(settlingValue(won, 0, SETTLE_SUCCESS_MS)).toBe(200);
  });
  it('denied investment drops to zero', () => {
    const lost = { ...order, status: 'failed' };
    expect(settlingValue(lost, 0, SETTLE_FAIL_MS)).toBe(0);
    expect(settlingValue(lost, 0, SETTLE_FAIL_MS / 2)).toBeGreaterThan(0);
  });
});

describe('live investment chart values', () => {
  const placed = { ...order, id: 'order-xyz', amount: 150, multiplier: 1.8, created_at: '2026-11-10T21:00:00.000Z' };
  const t0 = Date.parse(placed.created_at);
  it('starts exactly at the stake so PNL begins at zero', () => {
    expect(pendingValue(placed, t0)).toBeCloseTo(150, 6);
  });
  it('is identical for the same order and time, whichever device computes it', () => {
    expect(pendingValue({ ...placed }, t0 + 73_500)).toBe(pendingValue({ ...placed }, t0 + 73_500));
  });
  it('wanders both up and down and never leaves 0..payout', () => {
    const v = Array.from({ length: 600 }, (_, i) => pendingValue(placed, t0 + i * 1000));
    expect(Math.max(...v)).toBeGreaterThan(150);
    expect(Math.min(...v)).toBeLessThan(150);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...v)).toBeLessThanOrEqual(270);
  });
});

describe('settlement routes', () => {
  const base = { amount: 100, multiplier: 2, created_at: '2026-11-10T21:00:00.000Z' };
  const series = (o: { id: string; amount: number; multiplier: number; status: string; created_at: string }, ms: number) => {
    const start = Date.parse(o.created_at) + 90_000;
    return Array.from({ length: 401 }, (_, i) => settlingValue(o, start, start + (i / 400) * ms));
  };
  it('a win surges, pauses and pulls back before landing exactly on the payout', () => {
    const v = series({ ...base, id: 'win-1', status: 'success' }, SETTLE_SUCCESS_MS);
    expect(v[400]).toBe(200);
    expect(Math.max(...v)).toBeLessThanOrEqual(200);
    let peak = 0; let pullback = 0;
    for (const x of v) { peak = Math.max(peak, x); pullback = Math.max(pullback, peak - x); }
    expect(pullback).toBeGreaterThan(1);
  });
  it('a loss bounces on the way down and lands exactly on zero', () => {
    const v = series({ ...base, id: 'loss-1', status: 'failed' }, SETTLE_FAIL_MS);
    expect(v[400]).toBe(0);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
    let low = Infinity; let bounce = 0;
    for (const x of v) { low = Math.min(low, x); bounce = Math.max(bounce, x - low); }
    expect(bounce).toBeGreaterThan(1);
  });
  it('every order takes a different route', () => {
    const a = series({ ...base, id: 'order-a', status: 'success' }, SETTLE_SUCCESS_MS);
    const b = series({ ...base, id: 'order-b', status: 'success' }, SETTLE_SUCCESS_MS);
    const gap = [100, 200, 300].map(i => Math.abs((a[i] as number) - (b[i] as number)));
    expect(Math.max(...gap)).toBeGreaterThan(2);
  });
  it('the same order takes the same route on every device', () => {
    const o = { ...base, id: 'same', status: 'success' };
    expect(series(o, SETTLE_SUCCESS_MS)).toEqual(series({ ...o }, SETTLE_SUCCESS_MS));
  });
});

describe('one trade at a time', () => {
  const now = Date.parse('2026-11-10T22:00:00.000Z');
  it('is locked while a trade is pending', () => {
    expect(hasActiveTrade([{ status: 'pending', settled_at: null }], now)).toBe(true);
  });
  it('stays locked while a settled trade is still playing out, then frees up', () => {
    const settled = { status: 'success', settled_at: new Date(now - 20_000).toISOString() };
    expect(hasActiveTrade([settled], now)).toBe(true);
    expect(hasActiveTrade([settled], now + TRADE_LOCK_MS)).toBe(false);
  });
  it('is free with no orders or only old ones', () => {
    expect(hasActiveTrade([], now)).toBe(false);
    expect(hasActiveTrade([{ status: 'failed', settled_at: new Date(now - 3_600_000).toISOString() }], now)).toBe(false);
  });
});

describe('trade preparation', () => {
  const placed = (id: string) => ({ id, amount: 100, multiplier: 2, status: 'pending', created_at: '2026-11-10T21:00:00.000Z' });
  it('takes between 10 and 30 seconds, varies per trade, and is the same on every device', () => {
    const d = Array.from({ length: 200 }, (_, i) => prepDuration(placed(`trade-${i}`)));
    expect(Math.min(...d)).toBeGreaterThanOrEqual(10000);
    expect(Math.max(...d)).toBeLessThanOrEqual(30000);
    expect(new Set(d).size).toBeGreaterThan(100);
    expect(prepDuration(placed('same'))).toBe(prepDuration({ ...placed('same') }));
  });
  it('is preparing only until the fill time, and only while pending', () => {
    const o = placed('x'); const fill = fillTime(o);
    expect(isPreparing(o, fill - 1)).toBe(true);
    expect(isPreparing(o, fill)).toBe(false);
    expect(isPreparing({ ...o, status: 'success' }, fill - 1)).toBe(false);
  });
  it('works through each step, confirms it, and always finishes on placing the order', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const o = placed(id); const total = prepDuration(o);
      const seen: string[] = []; let confirmed = 0; let wasDone = false;
      for (let t = 0; t < total; t += 50) {
        const s = prepStage(o, t); if (seen[seen.length - 1] !== s.label) seen.push(s.label);
        if (s.done && !wasDone) confirmed++; wasDone = s.done;
      }
      expect(seen[0]).toBe('Searching coins');
      expect(seen[1]).toBe('Coin found');
      expect(seen[seen.length - 1]).toBe('Order placed');
      expect(new Set(seen).size).toBe(seen.length);
      expect(confirmed).toBe(seen.length / 2); // every step ends with a confirmation
    }
  });
  it('the live price starts at the stake exactly when the trade goes live', () => {
    const o = placed('start-check');
    expect(pendingValue(o, fillTime(o))).toBeCloseTo(100, 6);
    expect(pendingValue(o, fillTime(o) - 4000)).toBeCloseTo(100, 6);
  });
});

describe('stalls', () => {
  const o = { id: 'stall-test', amount: 100, multiplier: 2, status: 'pending', created_at: '2026-11-10T21:00:00.000Z' };
  const fill = fillTime(o);
  const longestRun = (v: number[]) => { let best = 0, run = 0; for (let i = 1; i < v.length; i++) { run = Math.abs((v[i] as number) - (v[i - 1] as number)) < 1e-9 ? run + 1 : 0; best = Math.max(best, run); } return best; };
  it('the pending price sometimes holds completely still for several seconds, but not all the time', () => {
    const v = Array.from({ length: 2400 }, (_, i) => pendingValue(o, fill + i * 250)); // 10 minutes
    expect(longestRun(v)).toBeGreaterThanOrEqual(12); // 3 seconds
    expect(longestRun(v)).toBeLessThan(60);
    expect(new Set(v.map(x => x.toFixed(2))).size).toBeGreaterThan(100);
  });
  it('the final move also pauses, and still lands exactly on the result', () => {
    const win = { ...o, status: 'success' };
    const start = fill + 60_000;
    const v = Array.from({ length: 221 }, (_, i) => settlingValue(win, start, start + (i / 220) * SETTLE_SUCCESS_MS));
    expect(longestRun(v)).toBeGreaterThanOrEqual(6);
    expect(v[220]).toBe(200);
  });
});
