import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatMoney } from '@/lib/categories';
import { liveChange, pendingValue, settleDuration, settlingValue, type LiveOrder } from '@/lib/live-trade';

type Order = LiveOrder & { settled_at: string | null };
const HOLD_MS = 2500;

/** Shows pending investments moving in real time, then glides settled ones to their outcome. */
export function LiveInvestments({ orders }: { orders: Order[] }) {
  const [now, setNow] = useState(() => Date.now());
  // Everything is derived from server timestamps, so every device shows the same value
  // and a finished settlement never replays after remounting or signing in again.
  const settleStart = (o: Order) => (o.status !== 'pending' && o.settled_at ? Date.parse(o.settled_at) : undefined);

  const visible = orders.filter(o => {
    if (o.status === 'pending') return true;
    const start = settleStart(o);
    return start !== undefined && now - start < settleDuration(o) + HOLD_MS;
  });

  useEffect(() => {
    if (visible.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [visible.length]);

  if (visible.length === 0) return null;
  return <div className="bank-processing">{visible.map(o => {
    const start = settleStart(o);
    const value = o.status === 'pending' || start === undefined ? pendingValue(o, now) : settlingValue(o, start, now);
    const done = o.status !== 'pending' && start !== undefined && now - start >= settleDuration(o);
    const { diff, percent, up } = liveChange(o, value);
    const label = done ? (o.status === 'success' ? 'Completed' : 'Failed') : o.status === 'pending' ? 'Live' : 'Closing';
    return <div key={o.id} className="bank-processing-row">
      <span className={`live-arrow ${up ? 'live-up' : 'live-down'}`} aria-hidden="true">{up ? <ArrowUp/> : <ArrowDown/>}</span>
      <div className="min-w-0 flex-1"><p className="font-semibold">Investment · {o.multiplier.toFixed(1)}×</p><p className="mt-1 text-xs text-muted-foreground">{label} · {formatMoney(o.amount)} in</p></div>
      <div className="text-right"><p className="font-display font-semibold tabular-nums">{formatMoney(value)}</p><p className={`mt-0.5 text-xs font-semibold tabular-nums ${up ? 'live-up-text' : 'live-down-text'}`}>{up ? '+' : '−'}{formatMoney(Math.abs(diff))} · {Math.abs(percent).toFixed(1)}%</p></div>
    </div>;
  })}</div>;
}
