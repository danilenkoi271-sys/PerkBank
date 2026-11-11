import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTradeFeed } from '@/lib/investing.functions';
import { formatMoney } from '@/lib/categories';
import type { Txn } from '@/lib/bank';
import type { FeedReceipt, FeedTrade } from '@/lib/trade-feed';
import { Overlay } from './AppShell';
import { EASE } from './motion';
import { Receipt } from './Receipt';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : date(iso);
}
const asTxn = (r: FeedReceipt, category: string): Txn => ({ id: r.reference, title: r.title, category, amount: r.amount, note: null, reference: r.reference, created_at: r.createdAt, icon: null });

/**
 * What the trading bot is, and everything that has been traded on Perk lately, live. The feed has no names: only the
 * trade, its times and its receipts.
 */
export function BotInfo({ open, onClose, maxMultiplier }: { open: boolean; onClose: () => void; maxMultiplier: number }) {
  const fetchFeed = useServerFn(getTradeFeed);
  const { data, isLoading, error } = useQuery({ queryKey: ['trade-feed'], queryFn: () => fetchFeed(), enabled: open, refetchInterval: 4000, retry: false });
  const [receipt, setReceipt] = useState<{ txn: Txn; trade: FeedTrade } | null>(null);
  const now = Date.now();
  const rows = data ?? [];
  return <Overlay><AnimatePresence>{open && <motion.div key="bot-info" role="dialog" aria-modal="true" aria-label="About the trading bot" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-md sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose}>
    <motion.div className="flex max-h-[88dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] bg-card text-card-foreground shadow-[0_40px_80px_-30px_rgb(11_12_14/.5)]" initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.5, ease: EASE }} onClick={e => e.stopPropagation()}>
      <div className="flex flex-none items-start justify-between gap-4 px-6 pb-2 pt-6">
        <div><span className="mono-label text-muted-foreground">Invest</span><h2 className="mt-1 text-[26px] font-medium leading-tight">About the trading bot</h2></div>
        <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2 -mt-1 rounded-full" onClick={onClose}><X className="h-4 w-4"/></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <dl className="mt-3 divide-y divide-border overflow-hidden rounded-2xl bg-muted">
          {([['Market', 'SOL'], ['Direction', 'Long only'], ['Targets', `1.1× to ${maxMultiplier.toFixed(1)}×`]] as const).map(([k, v]) => <div key={k} className="flex items-center justify-between gap-4 px-4 py-3"><dt className="mono-label text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">Choose a target and a stake. The bot looks for a coin, checks it and places the order, and your trade then plays out live. A trade that reaches its target pays out your stake times the target. One that doesn't loses the stake.</p>
        <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">Each order is checked, then routed to PumpPortal. The result that comes back decides whether the trade is approved or declined.</p>

        <div className="mt-7 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-medium"><span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inset-0 rounded-full bg-success animate-pulse-ring"/><span className="relative h-2 w-2 rounded-full bg-success"/></span>Live trades</h3>
          <span className="mono-label text-muted-foreground">Everyone · no names</span>
        </div>
        {isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading trades…</p>
        : error ? <p className="py-10 text-center text-sm text-muted-foreground">Live trades are unavailable right now.</p>
        : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No trades yet. The first one will appear here.</p>
        : <ul aria-label="Live trades" className="mt-3 space-y-2">{rows.map(t => <TradeRow key={t.id} t={t} now={now} onReceipt={setReceipt}/>)}</ul>}
        <p className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4 text-[13px]"><span className="mono-label text-muted-foreground">Routing</span><a href="https://pumpportal.fun" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4 transition hover:text-muted-foreground">https://pumpportal.fun</a></p>
      </div>
    </motion.div>
    <Receipt txn={receipt?.txn ?? null} iban="" holder="" anonymous trade={receipt ? { id: receipt.trade.id, amount: receipt.trade.amount, multiplier: receipt.trade.multiplier, status: receipt.trade.status, created_at: receipt.trade.placedAt, settled_at: receipt.trade.settledAt } : null} onClose={() => setReceipt(null)}/>
  </motion.div>}</AnimatePresence></Overlay>;
}

function TradeRow({ t, now, onReceipt }: { t: FeedTrade; now: number; onReceipt: (r: { txn: Txn; trade: FeedTrade }) => void }) {
  const live = t.status === 'pending'; const won = t.status === 'success';
  const result = live ? 'Live' : won ? `+${formatMoney(t.payout - t.amount)}` : `−${formatMoney(t.amount)}`;
  return <li className="rounded-2xl bg-muted px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><p className="font-medium">Bot trade · {t.multiplier.toFixed(1)}×</p><p className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono">{time(t.placedAt)}</span> · {ago(t.placedAt, now)}</p></div>
      <div className="text-right"><p className="tabular-nums font-medium">{formatMoney(t.amount)}</p><p className={`mt-0.5 text-xs font-medium tabular-nums ${live ? 'text-muted-foreground' : won ? 'text-success' : 'text-destructive'}`}>{live ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success"/>Live</span> : result}</p></div>
    </div>
    {(t.stake || t.payoutReceipt) && <div className="mt-2.5 flex flex-wrap gap-2">
      {t.stake && <button type="button" onClick={() => onReceipt({ txn: asTxn({ ...t.stake as FeedReceipt, amount: -t.amount }, 'investment'), trade: t })} className="rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-border transition hover:bg-secondary">Stake receipt <span className="font-mono text-muted-foreground">{t.stake.reference.slice(-6)}</span></button>}
      {t.payoutReceipt && <button type="button" onClick={() => onReceipt({ txn: asTxn(t.payoutReceipt as FeedReceipt, 'investment_payout'), trade: t })} className="rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-border transition hover:bg-secondary">Payout receipt <span className="font-mono text-muted-foreground">{t.payoutReceipt.reference.slice(-6)}</span></button>}
    </div>}
  </li>;
}
