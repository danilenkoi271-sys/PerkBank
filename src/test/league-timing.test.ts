import { describe, expect, it } from 'vitest';
import { asDisplayed, heldWinnings, isPlayingOut, SETTLE_FAIL_MS, SETTLE_SUCCESS_MS } from '@/lib/live-trade';
import { tradeStats } from '@/lib/investing';

const NOW = Date.parse('2026-11-10T22:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
type O = { id: string; amount: number; multiplier: number; status: string; payout: number; settled_at: string | null; created_at: string };
const win = (settledAgo: number, over: Partial<O> = {}): O => ({ id: 'w', amount: 100, multiplier: 2, status: 'success', payout: 200, settled_at: ago(settledAgo), created_at: ago(settledAgo + 120_000), ...over });
const loss = (settledAgo: number): O => ({ id: 'l', amount: 100, multiplier: 2, status: 'failed', payout: 0, settled_at: ago(settledAgo), created_at: ago(settledAgo + 120_000) });
const league = (orders: O[]) => tradeStats(orders.map(o => asDisplayed(o, NOW)), new Date(NOW));

describe('the league only moves once a chart has finished', () => {
  it('a win does not add profit while its chart is still playing', () => {
    const s = league([win(20_000)]);
    expect(s.pnl).toBe(0);
    expect(s.allTimePercent).toBe(0);
    expect(s.dailyPercent).toBe(0);
    expect(s.wagered).toBe(100); // the stake still counts as wagered
  });
  it('a loss does not take profit away while its chart is still playing', () => {
    expect(league([loss(20_000)]).pnl).toBe(0);
  });
  it('the moment the chart finishes, the result counts', () => {
    expect(league([win(SETTLE_SUCCESS_MS)]).pnl).toBe(100);
    expect(league([win(SETTLE_SUCCESS_MS - 1)]).pnl).toBe(0);
    expect(league([loss(SETTLE_FAIL_MS)]).pnl).toBe(-100);
    expect(league([loss(SETTLE_FAIL_MS - 1)]).pnl).toBe(0);
  });
  it('a loss plays out longer than a win, so it stays hidden longer', () => {
    expect(isPlayingOut(loss(SETTLE_SUCCESS_MS + 1_000), NOW)).toBe(true);
    expect(isPlayingOut(win(SETTLE_SUCCESS_MS + 1_000), NOW)).toBe(false);
  });
  it('nobody moves up or down the ranking until the chart is done', () => {
    const ranking = (a: O[], b: O[]) => [['A', league(a).pnl], ['B', league(b).pnl]].sort((x, y) => (y[1] as number) - (x[1] as number)).map(r => r[0]);
    const b = [win(SETTLE_SUCCESS_MS + 60_000, { id: 'b', payout: 120 })]; // B finished earlier with +20
    expect(ranking([win(10_000)], b)).toEqual(['B', 'A']); // A just won big but the chart has not finished
    expect(ranking([win(SETTLE_SUCCESS_MS + 1_000)], b)).toEqual(['A', 'B']); // now it has
  });
  it('still counts every finished trade and leaves pending ones out of profit', () => {
    const s = league([win(SETTLE_SUCCESS_MS + 10_000), loss(SETTLE_FAIL_MS + 10_000, ), { ...win(0), status: 'pending', payout: 0, settled_at: null, id: 'p' }]);
    expect(s.pnl).toBe(0); // +100 and −100
    expect(s.wagered).toBe(300);
  });
  it('does not change the real order', () => {
    const o = win(20_000); const before = JSON.stringify(o);
    asDisplayed(o, NOW);
    expect(JSON.stringify(o)).toBe(before);
  });
});

describe('balances shown to others do not include a win that is still playing out', () => {
  it('holds back a win in progress and releases it when the chart ends', () => {
    expect(heldWinnings([win(20_000)], NOW)).toBe(200);
    expect(heldWinnings([win(SETTLE_SUCCESS_MS)], NOW)).toBe(0);
  });
  it('holds back nothing for losses, pending trades or finished wins', () => {
    expect(heldWinnings([loss(20_000)], NOW)).toBe(0);
    expect(heldWinnings([{ ...win(0), status: 'pending', payout: 0, settled_at: null }], NOW)).toBe(0);
    expect(heldWinnings([win(SETTLE_SUCCESS_MS + 5_000)], NOW)).toBe(0);
  });
  it('adds up several wins in progress', () => {
    expect(heldWinnings([win(5_000, { id: 'a', payout: 150 }), win(9_000, { id: 'b', payout: 50 })], NOW)).toBe(200);
  });
});
