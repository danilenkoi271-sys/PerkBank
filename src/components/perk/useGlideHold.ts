import { useEffect, useMemo, useState } from 'react';
import { settleDuration } from '@/lib/live-trade';

type HeldOrder = { id?: string; status: string; settled_at?: string | null; amount?: number; multiplier?: number; payout?: number };

/**
 * The database credits a win the moment the admin approves it, but the user should only find out once the chart
 * has finished playing the result. While a settled trade is still playing out this reports how much of the balance
 * to hold back and which orders' payout entries to hide. `clockOffset` is (server time − device time) in ms.
 */
export function useGlideHold(orders: HeldOrder[], clockOffset = 0) {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const held = orders.filter(o => {
    const at = o.settled_at ? Date.parse(o.settled_at) : NaN;
    return o.status !== 'pending' && Number.isFinite(at) && now < at + settleDuration({ id: o.id ?? '', amount: 0, multiplier: 0, status: o.status });
  });
  const active = held.length > 0;
  // Depend on what the orders contain, not on the array's identity, so callers can pass a fresh array every render.
  const signature = orders.map(o => `${o.id}:${o.status}:${o.settled_at ?? ''}`).join('|');
  useEffect(() => {
    setNow(Date.now() + clockOffset);
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), 250);
    return () => window.clearInterval(timer);
  }, [active, clockOffset, signature]);
  const heldKey = held.map(o => `${o.id}:${o.payout ?? ''}`).join(',');
  return useMemo(() => ({
    heldPayout: held.reduce((sum, o) => sum + (o.status === 'success' ? (o.payout ?? (o.amount ?? 0) * (o.multiplier ?? 0)) : 0), 0),
    hiddenOrderIds: new Set(held.flatMap(o => (o.id ? [o.id] : []))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [heldKey]);
}
