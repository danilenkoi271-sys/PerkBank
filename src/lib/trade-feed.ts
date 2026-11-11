import { settleDuration } from './live-trade';

/** Raw rows as they come out of the database. Never sent to the browser as they are. */
export type FeedOrderRow = { id: string; user_id: string; amount: number; multiplier: number; status: string; payout: number; created_at: string; settled_at: string | null };
export type FeedTxnRow = { order_id: string | null; category: string; reference: string; created_at: string; amount: number; title: string };

export type FeedReceipt = { reference: string; title: string; amount: number; createdAt: string };
/** One trade in the public live feed. It deliberately carries nothing that identifies who placed it. */
export type FeedTrade = {
  id: string; amount: number; multiplier: number;
  status: 'pending' | 'success' | 'failed'; payout: number;
  placedAt: string; settledAt: string | null;
  stake: FeedReceipt | null; payoutReceipt: FeedReceipt | null;
};

const asReceipt = (t: FeedTxnRow): FeedReceipt => ({ reference: t.reference, title: t.title, amount: t.amount, createdAt: t.created_at });

/**
 * Builds the live trade feed: newest first, administrator accounts left out, and no names, user ids, account ids or
 * IBANs. A trade that has been settled but whose chart is still playing out for its owner is shown as still live,
 * so the feed can never reveal a result before the owner sees it.
 */
export function buildTradeFeed({ orders, txns, adminIds, now, limit = 50 }: { orders: FeedOrderRow[]; txns: FeedTxnRow[]; adminIds: ReadonlySet<string>; now: number; limit?: number }): FeedTrade[] {
  const byOrder = new Map<string, FeedTxnRow[]>();
  for (const t of txns) if (t.order_id) byOrder.set(t.order_id, [...(byOrder.get(t.order_id) ?? []), t]);
  return orders
    .filter(o => !adminIds.has(o.user_id))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit)
    .map(o => {
      const settled = o.settled_at ? Date.parse(o.settled_at) : NaN;
      const playing = o.status !== 'pending' && Number.isFinite(settled) && now < settled + settleDuration(o);
      const final = o.status !== 'pending' && !playing;
      const mine = byOrder.get(o.id) ?? [];
      const stake = mine.find(t => t.category === 'investment');
      const won = mine.find(t => t.category === 'investment_payout');
      return {
        id: o.id, amount: o.amount, multiplier: o.multiplier,
        status: final ? (o.status === 'success' ? 'success' : 'failed') : 'pending',
        payout: final ? o.payout : 0,
        placedAt: o.created_at,
        settledAt: final ? o.settled_at : null,
        stake: stake ? asReceipt(stake) : null,
        payoutReceipt: final && won ? asReceipt(won) : null,
      } satisfies FeedTrade;
    });
}
