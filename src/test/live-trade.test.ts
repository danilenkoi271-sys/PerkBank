import { describe, expect, it } from 'vitest';
import { pendingValue, settlingValue, SETTLE_FAIL_MS, SETTLE_SUCCESS_MS } from '@/lib/live-trade';

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
