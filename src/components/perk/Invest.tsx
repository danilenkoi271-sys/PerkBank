import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Fingerprint } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { FaceId } from '@/components/perk/FaceId';
import { placeTrade } from '@/lib/investing.functions';
import { formatMoney } from '@/lib/categories';
import { hasActiveTrade } from '@/lib/live-trade';
import { useGlideHold } from './useGlideHold';
import { perkFeedback } from './PerkFeedback';

type OrderState = { status: string; settled_at?: string | null };
const NO_ORDERS: OrderState[] = [];
export function Invest({ balance: rawBalance, onPlaced, orders = NO_ORDERS, clockOffset = 0 }: { balance: number; onPlaced: () => void; orders?: (OrderState & { id?: string; amount?: number; multiplier?: number; payout?: number })[]; clockOffset?: number }) {
  const { heldPayout } = useGlideHold(orders, clockOffset);
  const balance = rawBalance - heldPayout; // winnings stay hidden until their chart has finished
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
  return <section aria-label="Invest" className="mx-auto flex h-full w-full max-w-[940px] flex-col justify-center gap-3">
    <header className="mb-1 flex items-end justify-between gap-4 px-1">
      <div>
        <span className="mono-label hidden text-muted-foreground [@media(min-height:720px)]:inline">Invest</span>
        <h1 className="mt-1 text-[clamp(28px,5dvh,44px)] font-medium leading-[1.05]">Your next <span className="serif-accent">move.</span></h1>
      </div>
      <p className="pb-1 text-right text-[13px] text-muted-foreground">Available<span className="block text-[17px] font-medium text-ink tabular-nums">{formatMoney(balance)}</span></p>
    </header>
    {locked && <div role="status" className="panel-ink flex items-center gap-3 px-5 py-3.5 text-[14px]">
      <span className="relative flex h-2 w-2 flex-none" aria-hidden="true"><span className="absolute inset-0 rounded-full bg-[#3ddc84] animate-pulse-ring"/><span className="relative h-2 w-2 rounded-full bg-[#3ddc84]"/></span>
      <span className="text-bone/80">You have a trade running. You can place another once it finishes.</span>
    </div>}
    <div className="grid gap-3 md:grid-cols-2">
      <div className="panel invest-control p-5 sm:p-6">
        <div className="flex items-center justify-between"><span className="mono-label text-muted-foreground">Target</span><span className="mono-label text-muted-foreground">1.1× – 3.0×</span></div>
        <output aria-label="Selected multiplier" className="invest-figure mt-3 block">{multiplier.toFixed(1)}<span className="text-court">×</span></output>
        <Slider aria-label="Target multiplier" min={1.1} max={3} step={0.1} value={[multiplier]} disabled={busy || confirming || locked} onValueChange={v => setMultiplier(v[0] ?? 1.1)} className="trade-slider mt-4"/>
      </div>
      <div className="panel invest-control p-5 sm:p-6">
        <div className="flex items-center justify-between"><span className="mono-label text-muted-foreground">Amount</span><button type="button" disabled={balance <= 0 || busy || confirming || locked} onClick={() => setAmount(balance)} className="mono-label rounded-full bg-bone px-2.5 py-1 text-ink transition hover:bg-secondary disabled:opacity-40">Max</button></div>
        <output aria-label="Selected investment amount" className="invest-figure mt-3 block">{formatMoney(stake)}</output>
        <Slider aria-label="Investment amount slider" min={0} max={Math.max(balance, 0.01)} step={0.01} value={[stake]} disabled={balance <= 0 || busy || confirming || locked} onValueChange={v => setAmount(v[0] ?? 0)} className="trade-slider mt-4"/>
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="panel-ink flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <span className="text-sm text-bone/60">If it hits {multiplier.toFixed(1)}×</span>
        <motion.span key={payout.toFixed(2)} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-medium tracking-[-0.03em] tabular-nums">{formatMoney(payout)}</motion.span>
      </div>
      <Button onClick={confirm} disabled={busy || confirming || locked || stake <= 0} className="invest-place h-full min-h-14 w-full rounded-full bg-court text-base font-medium text-white hover:bg-[#2c56b0] disabled:opacity-40"><Fingerprint className="h-5 w-5"/>{busy ? 'Placing…' : 'Place investment'}</Button>
    </div>
    <FaceId open={confirming} successOnly onSuccess={() => void submit()} onCancel={() => { pending.current = null; setConfirming(false); }}/>
  </section>;
}
