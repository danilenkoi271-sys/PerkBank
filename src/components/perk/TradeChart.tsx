import { useId, useMemo } from 'react';
import type { TradeSeries, TradeSeriesOrder } from '@/lib/live-trade';
import { tradeSeries } from '@/lib/live-trade';

const W = 240;
const H = 72;
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function span(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

/**
 * The chart of a trade as a section of its receipt. It is replayed from the trade itself (see tradeSeries), so it is
 * the same line the owner watched live. Renders nothing for a trade that has not gone live yet.
 */
export function TradeChartSection({ order }: { order: TradeSeriesOrder & { amount: number } }) {
  const series = useMemo(() => tradeSeries(order, Date.now()), [order.id, order.status, order.settled_at, order.created_at, order.amount, order.multiplier]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!series) return null;
  return <Chart series={series} amount={order.amount}/>;
}

function Chart({ series, amount }: { series: TradeSeries; amount: number }) {
  const id = useId().replace(/:/g, '');
  const { points, start, end, finished } = series;
  const values = points.map(p => p[1]);
  const last = values[values.length - 1] ?? amount;
  const up = last >= amount;
  const color = up ? 'var(--success)' : 'var(--destructive)';
  let lo = Math.min(amount, ...values); let hi = Math.max(amount, ...values);
  const minSpan = amount * 0.03;
  if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
  const x = (t: number) => ((t - start) / (end - start || 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const line = points.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const percent = amount > 0 ? ((last - amount) / amount) * 100 : 0;
  const first = points[0] ?? [start, amount];
  return <div className="mt-4 rounded-2xl bg-muted p-3" role="group" aria-label="Trade chart">
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Trade chart</span>
      <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums" style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}>{finished ? `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%` : 'In progress'}</span>
    </div>
    <div className="relative mt-2.5 h-[72px]" role="img" aria-label={finished ? `Chart of the trade, ending ${up ? 'up' : 'down'} ${Math.abs(percent).toFixed(1)} percent` : 'Chart of the trade so far'}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs><linearGradient id={`tc${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" style={{ stopColor: color }} stopOpacity="0.22"/><stop offset="100%" style={{ stopColor: color }} stopOpacity="0"/></linearGradient></defs>
        <line x1="0" x2={W} y1={y(amount)} y2={y(amount)} stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" className="text-foreground"/>
        <path d={area} fill={`url(#tc${id})`}/>
        <path d={line} fill="none" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke: color }}/>
      </svg>
      <span aria-hidden="true" className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-card" style={{ left: 0, top: `${(y(first[1]) / H) * 100}%`, borderColor: color }}/>
      <span aria-hidden="true" className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: '100%', top: `${(y(last) / H) * 100}%`, background: color, boxShadow: `0 0 0 3px color-mix(in oklch, ${color} 22%, transparent)` }}/>
    </div>
    <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
      <span>{clock(start)}</span><span>{span(end - start)}</span><span>{clock(end)}</span>
    </div>
  </div>;
}
