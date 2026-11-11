import { describe, expect, it } from 'vitest';
import { buildTradeFeed, type FeedOrderRow, type FeedTxnRow } from '@/lib/trade-feed';
import { SETTLE_SUCCESS_MS } from '@/lib/live-trade';

const NOW = Date.parse('2026-11-10T22:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const order = (o: Partial<FeedOrderRow> & { id: string; user_id: string }): FeedOrderRow => ({ amount: 100, multiplier: 2, status: 'pending', payout: 0, created_at: ago(60_000), settled_at: null, ...o });
const txn = (order_id: string, category: string, reference: string, amount: number): FeedTxnRow => ({ order_id, category, reference, created_at: ago(30_000), amount, title: category === 'investment' ? 'Bot trade · 2×' : 'Bot trade won · 2×' });
const feed = (orders: FeedOrderRow[], txns: FeedTxnRow[] = [], admins: string[] = ['admin-user'], limit?: number) => buildTradeFeed({ orders, txns, adminIds: new Set(admins), now: NOW, ...(limit ? { limit } : {}) });

describe('the public live trade feed', () => {
  it('leaves the administrator out completely', () => {
    const f = feed([order({ id: 'a', user_id: 'admin-user' }), order({ id: 'b', user_id: 'someone' })]);
    expect(f.map(t => t.id)).toEqual(['b']);
  });
  it('shows newest first and respects the limit', () => {
    const orders = [1, 2, 3, 4].map(i => order({ id: `o${i}`, user_id: `u${i}`, created_at: ago(i * 10_000) }));
    expect(feed(orders).map(t => t.id)).toEqual(['o1', 'o2', 'o3', 'o4']);
    expect(feed(orders, [], [], 2).map(t => t.id)).toEqual(['o1', 'o2']);
  });
  it('carries nothing that identifies who placed a trade', () => {
    const f = feed([order({ id: 'a', user_id: 'secret-user-id', account_id: 'secret-account' } as never)], [txn('a', 'investment', 'PK0000000001', -100)]);
    const text = JSON.stringify(f);
    expect(text).not.toContain('secret-user-id');
    expect(text).not.toContain('secret-account');
    expect(Object.keys(f[0] as object).sort()).toEqual(['amount', 'id', 'multiplier', 'payout', 'payoutReceipt', 'placedAt', 'settledAt', 'stake', 'status']);
    expect(Object.keys(f[0]?.stake as object).sort()).toEqual(['amount', 'createdAt', 'reference', 'title']);
  });
  it('attaches the stake receipt, and the payout receipt once a win has finished', () => {
    const o = order({ id: 'w', user_id: 'u', status: 'success', payout: 200, settled_at: ago(SETTLE_SUCCESS_MS + 5_000) });
    const [t] = feed([o], [txn('w', 'investment', 'PK1', -100), txn('w', 'investment_payout', 'PK2', 200)]);
    expect(t?.status).toBe('success');
    expect(t?.payout).toBe(200);
    expect(t?.stake?.reference).toBe('PK1');
    expect(t?.payoutReceipt?.reference).toBe('PK2');
  });
  it('never reveals a result while the owner’s chart is still playing it out', () => {
    const o = order({ id: 'w', user_id: 'u', status: 'success', payout: 200, settled_at: ago(10_000) });
    const [t] = feed([o], [txn('w', 'investment', 'PK1', -100), txn('w', 'investment_payout', 'PK2', 200)]);
    expect(t?.status).toBe('pending');
    expect(t?.payout).toBe(0);
    expect(t?.settledAt).toBeNull();
    expect(t?.payoutReceipt).toBeNull();
    expect(t?.stake?.reference).toBe('PK1');
  });
  it('shows a failed trade only once its chart has finished too', () => {
    const lost = (ms: number) => feed([order({ id: 'l', user_id: 'u', status: 'failed', settled_at: ago(ms) })])[0];
    expect(lost(5_000)?.status).toBe('pending');
    expect(lost(120_000)?.status).toBe('failed');
    expect(lost(120_000)?.payoutReceipt).toBeNull();
  });
  it('is empty when there are no trades', () => { expect(feed([])).toEqual([]); });
});
