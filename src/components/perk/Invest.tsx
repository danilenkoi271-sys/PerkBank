import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Fingerprint } from 'lucide-react';
import { motion } from 'motion/react';
import { PageHeading } from './AppShell';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { FaceId } from '@/components/perk/FaceId';
import { placeTrade } from '@/lib/investing.functions';
import { formatMoney } from '@/lib/categories';
import { hasActiveTrade } from '@/lib/live-trade';
import { perkFeedback } from './PerkFeedback';

type OrderState = { status: string; settled_at?: string | null };
const NO_ORDERS: OrderState[] = [];
export function Invest({ balance, onPlaced, orders = NO_ORDERS, clockOffset = 0 }: { balance: number; onPlaced: () => void; orders?: OrderState[]; clockOffset?: number }) {
  // One trade at a time: locked while a trade is pending or still playing out its result.
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const locked = hasActiveTrade(orders, now);
  useEffect(() => {
    setNow(Date.now() + clockOffset);
    if (!locked) return;
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => window.clearInterval(timer);
  }, [locked, orders, clockOffset]);
  const [multiplier, setMultiplier] = useState(1.5);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<{ amount: number; multiplier: number } | null>(null);
  const submitting = useRef(false);
  const place = useServerFn(placeTrade);
  const stake = Math.min(amount, balance);
  function confirm() {
    if (stake <= 0 || busy || confirming || locked) return;
    pending.current = { amount: stake, multiplier };
    setConfirming(true);
  }
  async function submit() {
    const order = pending.current;
    if (!order || submitting.current) return;
    pending.current = null;
    submitting.current = true;
    setConfirming(false);
    setBusy(true);
    try { await place({ data: order }); perkFeedback('Investment placed', 'success', `${formatMoney(order.amount)} · ${order.multiplier.toFixed(1)}×`); setAmount(0); onPlaced(); }
    catch (e) { perkFeedback(e instanceof Error ? e.message : 'Investment failed', 'error'); }
    finally { submitting.current = false; setBusy(false); }
  }
  const payout = stake * multiplier;
  return <section aria-label="Invest" className="mx-auto max-w-[620px]">
    <PageHeading eyebrow="Invest" title="Your next" accent="move.">
      <p className="mt-4 text-[15px] text-muted-foreground">Available <span className="ml-1 font-medium text-ink tabular-nums">{formatMoney(balance)}</span></p>
    </PageHeading>
    {locked && <div role="status" className="panel-ink mb-3 flex items-center gap-3 px-5 py-4 text-[14px]">
      <span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inset-0 rounded-full bg-[#3ddc84] animate-pulse-ring"/><span className="relative h-2 w-2 rounded-full bg-[#3ddc84]"/></span>
      <span className="text-bone/80">You have a trade running. You can place another once it finishes.</span>
    </div>}
    <div className="panel divide-y divide-border">
      <div className="invest-control p-6 sm:p-8">
        <div className="flex items-center justify-between"><span className="mono-label text-muted-foreground">Target</span><span className="mono-label text-muted-foreground">1.1× – 3.0×</span></div>
        <output aria-label="Selected multiplier" className="invest-figure mt-5 block">{multiplier.toFixed(1)}<span className="text-court">×</span></output>
        <Slider aria-label="Target multiplier" min={1.1} max={3} step={0.1} value={[multiplier]} disabled={busy || confirming || locked} onValueChange={v => setMultiplier(v[0] ?? 1.1)} className="trade-slider mt-6"/>
      </div>
      <div className="invest-control p-6 sm:p-8">
        <div className="flex items-center justify-between"><span className="mono-label text-muted-foreground">Amount</span><button type="button" disabled={balance <= 0 || busy || confirming || locked} onClick={() => setAmount(balance)} className="mono-label rounded-full bg-bone px-2.5 py-1 text-ink transition hover:bg-secondary disabled:opacity-40">Max</button></div>
        <output aria-label="Selected investment amount" className="invest-figure mt-5 block">{formatMoney(stake)}</output>
        <Slider aria-label="Investment amount slider" min={0} max={Math.max(balance, 0.01)} step={0.01} value={[stake]} disabled={balance <= 0 || busy || confirming || locked} onValueChange={v => setAmount(v[0] ?? 0)} className="trade-slider mt-6"/>
      </div>
    </div>
    <div className="panel-ink mt-3 flex items-center justify-between gap-4 px-6 py-5 sm:px-8">
      <span className="text-sm text-bone/60">If it hits {multiplier.toFixed(1)}×</span>
      <motion.span key={payout.toFixed(2)} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-medium tracking-[-0.03em] tabular-nums">{formatMoney(payout)}</motion.span>
    </div>
    <Button onClick={confirm} disabled={busy || confirming || locked || stake <= 0} className="invest-place mt-3 h-14 w-full rounded-full bg-court text-base font-medium text-white hover:bg-[#2c56b0] disabled:opacity-40"><Fingerprint className="h-5 w-5"/>{busy ? 'Placing…' : 'Place investment'}</Button>
    <FaceId open={confirming} successOnly onSuccess={() => void submit()} onCancel={() => { pending.current = null; setConfirming(false); }}/>
  </section>;
}
