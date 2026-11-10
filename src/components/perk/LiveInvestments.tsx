import { useEffect, useId, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatMoney } from '@/lib/categories';
import { liveChange, pendingValue, settleDuration, settlingValue, type LiveOrder } from '@/lib/live-trade';

type Order = LiveOrder & { settled_at: string | null; created_at: string };

const HOLD_MS = 4500;
const W = 400;
const H = 140;
const UP = '#3ddc84';
const DOWN = '#ff6b6b';

const valueAt = (o: Order, settleStart: number | undefined, t: number) =>
  settleStart !== undefined && t >= settleStart ? settlingValue(o, settleStart, t) : pendingValue(o, t);

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export type LiveOrderRow = Order;
export const settleStartOf = (o: Order) => (o.status !== 'pending' && o.settled_at ? Date.parse(o.settled_at) : undefined);

/**
 * Live positions for the home screen. Everything is derived from the order id, its server timestamps and the
 * server clock, so the same account shows the same price, PNL and line on every device.
 * `clockOffset` is (server time − device time) in ms.
 */
export function useLivePositions(orders: Order[], clockOffset = 0) {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const visible = orders.filter(o => {
    if (o.status === 'pending') return true;
    const start = settleStartOf(o);
    return start !== undefined && now - start < settleDuration(o) + HOLD_MS;
  });
  const active = visible.length > 0;
  useEffect(() => {
    if (!active) return;
    setNow(Date.now() + clockOffset);
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), 120);
    return () => window.clearInterval(timer);
  }, [active, clockOffset]);
  return { visible, now };
}

/** One position: status, price, PNL and the live line. It carries no frame of its own; the balance card holds it. */
export function Position({ order, now }: { order: Order; now: number }) {
  const start = settleStartOf(order);
  const value = valueAt(order, start, now);
  // The result is only revealed once the price has actually reached it.
  const done = order.status !== 'pending' && start !== undefined && now - start >= settleDuration(order);
  const { diff, percent, up } = liveChange(order, value);
  const label = done ? (order.status === 'success' ? 'Success' : 'Failed') : 'Live';
  const color = up ? UP : DOWN;
  const created = Date.parse(order.created_at);
  return <div aria-label={`Live investment ${order.multiplier.toFixed(1)}×`}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          {!done && <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: color }}/>}
          <span className="relative h-2 w-2 rounded-full" style={{ background: color }}/>
        </span>
        <span className="mono-label" style={{ color: done ? color : 'rgb(243 242 238 / .7)' }}>{label}</span>
        <span className="text-[13px] text-bone/45">Investment · {order.multiplier.toFixed(1)}×</span>
      </div>
      <span className="font-mono text-[12px] tabular-nums text-bone/45">{Number.isFinite(created) ? clock((start !== undefined ? Math.min(now, start + settleDuration(order)) : now) - created) : '00:00'}</span>
    </div>

    <div className="mt-5 flex items-end justify-between gap-4">
      <p className="text-[clamp(34px,4vw,46px)] font-medium leading-none tracking-[-0.05em] tabular-nums">{formatMoney(value)}</p>
      <div className="text-right" style={{ color }}>
        <p className="flex items-center justify-end gap-1 text-[15px] font-medium tabular-nums">{up ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}{up ? '+' : '−'}{formatMoney(Math.abs(diff))}</p>
        <p className="mt-0.5 text-[13px] tabular-nums opacity-80">{up ? '+' : '−'}{Math.abs(percent).toFixed(2)}%</p>
      </div>
    </div>

    <Chart order={order} start={start} now={now} color={color}/>
  </div>;
}

// A fixed window keeps the horizontal scale constant. Samples sit on a fixed time grid, so once the line reaches the
// right edge it simply slides left without any point changing its shape.
const WINDOW_MS = 90_000;
const STEP_MS = 500;
const LOOKBACK_MS = 1_200_000;
const DOMAIN_STEP_MS = 2000;

function Chart({ order, start, now, color }: { order: Order; start: number | undefined; now: number; color: string }) {
  const id = useId().replace(/:/g, '');
  const parsed = Date.parse(order.created_at);
  const created = Number.isFinite(parsed) ? parsed : now;
  const growing = now - created < WINDOW_MS; // the line draws in from the left until it reaches the right edge
  const from = growing ? created : now - WINDOW_MS;
  const at = (t: number) => valueAt(order, start, t);

  const pts: [number, number][] = [];
  if (growing) pts.push([created, at(created)]);
  for (let t = Math.ceil(Math.max(growing ? created : Math.floor(from / STEP_MS) * STEP_MS, created) / STEP_MS) * STEP_MS; t < now; t += STEP_MS) pts.push([t, at(t)]);
  pts.push([now, at(now)]);

  // Centred on the entry line with a fixed minimum height, so the line sits still. It only grows if the price
  // really leaves that band (for example during the final move to the result).
  const minHalf = order.amount * (0.04 + 0.12 * (order.multiplier - 1)) * 1.4;
  let below = minHalf; let above = minHalf;
  const seen = (v: number) => { if (order.amount - v > below) below = order.amount - v; if (v - order.amount > above) above = v - order.amount; };
  for (let t = Math.ceil(Math.max(created, now - LOOKBACK_MS) / DOMAIN_STEP_MS) * DOMAIN_STEP_MS; t < now; t += DOMAIN_STEP_MS) seen(at(t));
  for (const p of pts) seen(p[1]);
  const lo = order.amount - below * 1.16; const hi = order.amount + above * 1.16;
  const x = (t: number) => ((t - from) / WINDOW_MS) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  const line = pts.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1] ?? [now, order.amount];
  const first = pts[0] ?? last;
  const area = `${line} L${x(last[0]).toFixed(1)} ${H} L${x(first[0]).toFixed(1)} ${H} Z`;
  const entryY = y(order.amount);
  const fade = growing ? undefined : 'linear-gradient(90deg, transparent, #000 12%)';

  return <div className="relative mt-6 h-[140px]" role="img" aria-label="Live profit and loss chart">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-hidden" style={fade ? { WebkitMaskImage: fade, maskImage: fade } : undefined}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient>
      </defs>
      <line x1="0" x2={W} y1={entryY} y2={entryY} stroke="rgb(243 242 238 / .16)" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke"/>
      <path d={area} fill={`url(#g${id})`}/>
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    </svg>
    <span aria-hidden="true" className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(x(last[0]) / W) * 100}%`, top: `${(y(last[1]) / H) * 100}%` }}>
      <span className="absolute -inset-1.5 rounded-full animate-pulse-ring" style={{ background: color, opacity: 0.5 }}/>
      <span className="relative block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }}/>
    </span>
  </div>;
}
