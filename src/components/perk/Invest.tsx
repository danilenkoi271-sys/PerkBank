import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { FaceId } from '@/components/perk/FaceId';
import { placeTrade } from '@/lib/investing.functions';
import { formatMoney } from '@/lib/categories';
import { perkFeedback } from './PerkFeedback';

export function Invest({ balance, onPlaced }: { balance: number; onPlaced: () => void }) {
  const [multiplier, setMultiplier] = useState(1.5);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<{ amount: number; multiplier: number } | null>(null);
  const submitting = useRef(false);
  const place = useServerFn(placeTrade);
  const stake = Math.min(amount, balance);
  function confirm() {
    if (stake <= 0 || busy || confirming) return;
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
  return <section aria-label="Invest" className="minimal-invest">
    <div className="invest-control"><output aria-label="Selected multiplier">{multiplier.toFixed(1)}<span>×</span></output><Slider aria-label="Target multiplier" min={1.1} max={3} step={0.1} value={[multiplier]} disabled={busy || confirming} onValueChange={v => setMultiplier(v[0] ?? 1.1)} className="trade-slider"/></div>
    <div className="invest-control"><output aria-label="Selected investment amount">{formatMoney(stake)}</output><Slider aria-label="Investment amount slider" min={0} max={Math.max(balance, 0.01)} step={0.01} value={[stake]} disabled={balance <= 0 || busy || confirming} onValueChange={v => setAmount(v[0] ?? 0)} className="trade-slider"/></div>
    <Button onClick={confirm} disabled={busy || confirming || stake <= 0} className="invest-place"><ArrowUpRight className="h-5 w-5"/>{busy ? 'Placing…' : 'Place investment'}</Button>
    <FaceId open={confirming} successOnly onSuccess={() => void submit()} onCancel={() => { pending.current = null; setConfirming(false); }}/>
  </section>;
}