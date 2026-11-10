import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatMoney } from '@/lib/categories';
import { liveChange, pendingValue, settleDuration, settlingValue, type LiveOrder } from '@/lib/live-trade';
import { EASE } from './motion';

type Order = LiveOrder & { settled_at: string | null; created_at: string };

const HOLD_MS = 2500;
const WINDOW_MIN = 60_000;
const WINDOW_MAX = 240_000;
const POINTS = 110;
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

/**
 * Live positions on the home screen. Everything here is derived from the order id, its server timestamps and the
 * server clock, so the same account shows the same price, PNL and line on every device.
 * `clockOffset` is (server time − device time) in ms.
 */
export function LiveInvestments({ orders, clockOffset = 0 }: { orders: Order[]; clockOffset?: number }) {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const settleStart = (o: Order) => (o.status !== 'pending' && o.settled_at ? Date.parse(o.settled_at) : undefined);
  const visible = orders.filter(o => {
    if (o.status === 'pending') return true;
    const start = settleStart(o);
    return start !== undefined && now - start < settleDuration(o) + HOLD_MS;
  });

  useEffect(() => {
    if (visible.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), 120);
    return () => window.clearInterval(timer);
  }, [visible.length, clockOffset]);

  return <AnimatePresence initial={false}>{visible.map(o => <Position key={o.id} order={o} start={settleStart(o)} now={now}/>)}</AnimatePresence>;
}

function Position({ order, start, now }: { order: Order; start: number | undefined; now: number }) {
  const value = valueAt(order, start, now);
  const done = order.status !== 'pending' && start !== undefined && now - start >= settleDuration(order);
  const { diff, percent, up } = liveChange(order, value);
  const label = done ? (order.status === 'success' ? 'Completed' : 'Failed') : order.status === 'pending' ? 'Live' : 'Closing';
  const color = up ? UP : DOWN;
  const created = Date.parse(order.created_at);
  const ticking = !done;
  return <motion.section layout initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.7, ease: EASE }} className="panel-ink relative overflow-hidden p-5 sm:p-6" aria-label={`Live investment ${order.multiplier.toFixed(1)}×`}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          {ticking && <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: color }}/>}
          <span className="relative h-2 w-2 rounded-full" style={{ background: done ? 'rgb(243 242 238 / .4)' : color }}/>
        </span>
        <span className="mono-label text-bone/70">{label}</span>
        <span className="text-[13px] text-bone/45">Investment · {order.multiplier.toFixed(1)}×</span>
      </div>
      <span className="font-mono text-[12px] tabular-nums text-bone/45">{Number.isFinite(created) ? clock((start !== undefined ? Math.min(now, start) : now) - created) : '00:00'}</span>
    </div>

    <div className="mt-5 flex items-end justify-between gap-4">
      <p className="text-[clamp(34px,4vw,46px)] font-medium leading-none tracking-[-0.05em] tabular-nums">{formatMoney(value)}</p>
      <div className="text-right" style={{ color }}>
        <p className="flex items-center justify-end gap-1 text-[15px] font-medium tabular-nums">{up ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}{up ? '+' : '−'}{formatMoney(Math.abs(diff))}</p>
        <p className="mt-0.5 text-[13px] tabular-nums opacity-80">{up ? '+' : '−'}{Math.abs(percent).toFixed(2)}%</p>
      </div>
    </div>

    <Chart order={order} start={start} now={now} color={color}/>

    <div className="mt-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-bone/40">
      <span>Entry {formatMoney(order.amount)}</span>
      <span>Target {formatMoney(order.amount * order.multiplier)}</span>
    </div>
  </motion.section>;
}

function Chart({ order, start, now, color }: { order: Order; start: number | undefined; now: number; color: string }) {
  const id = useId().replace(/:/g, '');
  const parsed = Date.parse(order.created_at);
  const created = Number.isFinite(parsed) ? parsed : now;
  const elapsed = Math.max(0, now - created);
  // The line grows from the left over the first minute, then the window slides along with the clock.
  const span = Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, elapsed));
  const end = elapsed < WINDOW_MIN ? created + WINDOW_MIN : now;
  const from = end - span;
  const step = span / POINTS;

  const pts: [number, number][] = [];
  for (let t = Math.max(from, created); t < now; t += step) pts.push([t, valueAt(order, start, t)]);
  pts.push([now, valueAt(order, start, now)]);

  const vals = pts.map(p => p[1]);
  let lo = Math.min(order.amount, ...vals); let hi = Math.max(order.amount, ...vals);
  const minSpan = order.amount * 0.03;
  if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  const pad = (hi - lo) * 0.16; lo -= pad; hi += pad;
  const x = (t: number) => ((t - from) / span) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  const line = pts.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1] ?? [now, order.amount];
  const first = pts[0] ?? last;
  const area = `${line} L${x(last[0]).toFixed(1)} ${H} L${x(first[0]).toFixed(1)} ${H} Z`;
  const entryY = y(order.amount);

  return <div className="relative mt-5 h-[140px]" role="img" aria-label="Live profit and loss chart">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
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
