import { describe, expect, it } from 'vitest';
import { fillTime, prepDuration, settleDuration, tradeSeries, type TradeSeriesOrder } from '@/lib/live-trade';

const T0 = '2026-11-10T21:00:00.000Z';
const mk = (over: Partial<TradeSeriesOrder> = {}): TradeSeriesOrder => ({ id: 'series-test', amount: 100, multiplier: 2, status: 'pending', created_at: T0, settled_at: null, ...over });
const win = (): TradeSeriesOrder => mk({ status: 'success', settled_at: '2026-11-10T21:05:00.000Z' });
const loss = (): TradeSeriesOrder => mk({ status: 'failed', settled_at: '2026-11-10T21:05:00.000Z' });
const LATE = Date.parse('2026-11-11T09:00:00.000Z');

describe('the chart replayed for a receipt', () => {
  it('has nothing to show before the trade went live, or without timestamps', () => {
    expect(tradeSeries(mk(), Date.parse(T0))).toBeNull();
    expect(tradeSeries(mk(), fillTime(mk()) - 1)).toBeNull();
    expect(tradeSeries({ id: 'x', amount: 100, multiplier: 2, status: 'pending' }, LATE)).toBeNull();
  });
  it('starts at the stake, exactly when the trade went live', () => {
    const s = tradeSeries(win(), LATE)!;
    expect(s.start).toBe(fillTime(win()));
    expect(s.points[0]?.[1]).toBeCloseTo(100, 6);
  });
  it('ends on the payout for a win and on zero for a loss', () => {
    const w = tradeSeries(win(), LATE)!; const l = tradeSeries(loss(), LATE)!;
    expect(w.finished).toBe(true); expect(w.points[w.points.length - 1]?.[1]).toBe(200);
    expect(l.finished).toBe(true); expect(l.points[l.points.length - 1]?.[1]).toBe(0);
  });
  it('runs from going live to the end of the final move', () => {
    const w = tradeSeries(win(), LATE)!;
    expect(w.end).toBe(Date.parse('2026-11-10T21:05:00.000Z') + settleDuration(win()));
  });
  it('is not finished while the final move is still playing, and stops at now', () => {
    const now = Date.parse('2026-11-10T21:05:00.000Z') + 10_000;
    const s = tradeSeries(win(), now)!;
    expect(s.finished).toBe(false);
    expect(s.end).toBe(now);
  });
  it('a trade that is still running charts up to now and is not finished', () => {
    const now = fillTime(mk()) + 90_000; const s = tradeSeries(mk(), now)!;
    expect(s.finished).toBe(false); expect(s.end).toBe(now);
  });
  it('is identical every time and on every device', () => {
    expect(tradeSeries(win(), LATE)).toEqual(tradeSeries({ ...win() }, LATE));
    expect(tradeSeries(win(), LATE)).toEqual(tradeSeries(win(), LATE + 5_000_000));
  });
  it('keeps points in time order, within the payout range, and never too many', () => {
    for (const o of [win(), loss()]) {
      const s = tradeSeries(o, LATE, 120)!;
      expect(s.points.length).toBeLessThanOrEqual(122);
      for (let i = 1; i < s.points.length; i++) expect((s.points[i] as [number, number])[0]).toBeGreaterThan((s.points[i - 1] as [number, number])[0]);
      for (const [, v] of s.points) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(200); }
    }
  });
  it('different trades draw different charts', () => {
    const a = tradeSeries({ ...win(), id: 'aaa' }, LATE, 60)!; const b = tradeSeries({ ...win(), id: 'bbb' }, LATE, 60)!;
    expect(a.points.map(p => Math.round(p[1]))).not.toEqual(b.points.map(p => Math.round(p[1])));
  });
  it('a long trade is still drawn with a bounded number of points', () => {
    const long = mk({ status: 'success', settled_at: '2026-11-10T23:30:00.000Z' });
    expect(tradeSeries(long, LATE, 240)!.points.length).toBeLessThanOrEqual(242);
  });
  it('the thinking phase is not part of the chart', () => {
    expect(fillTime(mk()) - Date.parse(T0)).toBe(prepDuration(mk()));
  });
});

/**
 * GOLDEN TEST. These two trades' charts are frozen. If this fails, the price model changed, and every receipt that
 * has ever been issued would now draw a different line from the one its owner watched live. Only update these numbers
 * on purpose, knowing that old receipts will change.
 */
describe('old receipts keep drawing exactly the same chart', () => {
  const round = (pts: [number, number][]) => pts.map(p => Math.round(p[1] * 100) / 100);
  it('a winning trade', () => {
    const o = { id: '3f2b6c1e-9a47-4d5e-8b12-7c0d9e4a1f55', amount: 150, multiplier: 1.8, status: 'success', created_at: T0, settled_at: '2026-11-10T21:05:00.000Z' };
    const s = tradeSeries(o, LATE, 12)!;
    expect(s.end).toBe(Date.parse('2026-11-10T21:05:55.000Z'));
    expect(round(s.points)).toEqual([150, 151.58, 127.98, 129.97, 129.65, 136.65, 149.03, 142.39, 144.74, 142.97, 138.13, 232.57, 270]);
  });
  it('a losing trade', () => {
    const o = { id: '8d1e4a7c-2b95-4f03-a6c8-1e5d7b9f3a20', amount: 80, multiplier: 2.4, status: 'failed', created_at: T0, settled_at: '2026-11-10T21:03:30.000Z' };
    const s = tradeSeries(o, LATE, 12)!;
    expect(s.end).toBe(Date.parse('2026-11-10T21:04:35.000Z'));
    expect(round(s.points)).toEqual([80, 87.13, 90.64, 78.64, 72.97, 74.1, 72.31, 76.54, 84.93, 77.22, 57.45, 33.91, 0]);
  });
});
