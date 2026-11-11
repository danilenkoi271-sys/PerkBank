import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { Check, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FaceId } from '@/components/perk/FaceId';
import { checkIbanAvailable, purchasePerk } from '@/lib/perks.functions';
import { buyStatus, formatPoints, owns, shortfall, type CatalogEntry, type PerkState } from '@/lib/perks';
import { PageHeading } from './AppShell';
import { EASE } from './motion';
import { PERK_UI } from './perk-ui';
import { perkFeedback } from './PerkFeedback';

type IbanCheck = 'idle' | 'checking' | 'available' | 'taken' | 'self' | 'error';
type Order = { perkId: string; iban?: string };

function PointsCount({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const [shown, setShown] = useState(value);
  useEffect(() => mv.on('change', v => setShown(Math.round(v))), [mv]);
  useEffect(() => { const c = animate(mv, value, { duration: 1.2, ease: EASE }); return () => c.stop(); }, [value, mv]);
  return <>{new Intl.NumberFormat('en-US').format(shown)}</>;
}

/** The perk points balance and the perks you can spend them on. Every purchase is confirmed with Face ID. */
export function PerksShop({ state, iban, onChanged }: { state: PerkState; iban: string; onChanged: () => void }) {
  const buy = useServerFn(purchasePerk);
  const check = useServerFn(checkIbanAvailable);
  const [open, setOpen] = useState<string | null>(null);
  const [newIban, setNewIban] = useState('');
  const [ibanCheck, setIbanCheck] = useState<IbanCheck>('idle');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Order | null>(null);
  const submitting = useRef(false);
  const lookup = useRef(0);

  // Live availability check while a new IBAN is typed (debounced; stale answers are ignored).
  useEffect(() => {
    if (newIban.length !== 5) { setIbanCheck('idle'); return; }
    if (newIban === iban) { setIbanCheck('self'); return; }
    const id = ++lookup.current; setIbanCheck('checking');
    const timer = window.setTimeout(() => {
      check({ data: { iban: newIban } })
        .then(r => { if (id === lookup.current) setIbanCheck(r.self ? 'self' : r.available ? 'available' : 'taken'); })
        .catch(() => { if (id === lookup.current) setIbanCheck('error'); });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [newIban, iban, check]);

  function start(order: Order) {
    if (busy || confirming) return;
    pending.current = order;
    setConfirming(true);
  }
  async function submit() {
    const order = pending.current;
    if (!order || submitting.current) return;
    pending.current = null; submitting.current = true;
    setConfirming(false); setBusy(true);
    try {
      await buy({ data: order });
      const ui = PERK_UI[order.perkId];
      perkFeedback('Perk unlocked', 'success', ui?.title);
      setOpen(null); setNewIban(''); setIbanCheck('idle');
      onChanged();
    } catch (e) { perkFeedback(e instanceof Error ? e.message : 'Purchase failed', 'error'); }
    finally { submitting.current = false; setBusy(false); }
  }

  const perks = state.catalog.filter((p): p is CatalogEntry => p.id in PERK_UI);
  return <section aria-label="Perks" className="mx-auto w-full max-w-[940px]">
    <PageHeading eyebrow="Rewards" title="Your" accent="perks."/>
    <div className="panel-ink balance-panel relative overflow-hidden p-6 sm:p-8">
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="mono-label text-bone/50">Perk points</span>
          <p aria-label="Perk points balance" className="mt-2 text-[clamp(44px,8dvh,72px)] font-medium leading-none tracking-[-0.05em] tabular-nums"><PointsCount value={state.balance}/></p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-bone/60"><Sparkles className="h-3.5 w-3.5"/>Earn 10 points for every $1 you invest, win or lose.</p>
        </div>
        <dl className="flex gap-2 text-sm">
          <div className="rounded-2xl bg-white/[0.07] px-4 py-2.5"><dt className="mono-label text-bone/45">Earned</dt><dd className="mt-0.5 tabular-nums">{formatPoints(state.earned)}</dd></div>
          <div className="rounded-2xl bg-white/[0.07] px-4 py-2.5"><dt className="mono-label text-bone/45">Spent</dt><dd className="mt-0.5 tabular-nums">{formatPoints(state.spent)}</dd></div>
        </dl>
      </div>
    </div>

    <ul className="mt-3 grid gap-3 md:grid-cols-2">{perks.map((perk, i) => {
      const ui = PERK_UI[perk.id]; if (!ui) return null;
      const Icon = ui.icon; const status = buyStatus(state, perk); const expanded = open === perk.id;
      const isIban = perk.id === 'custom_iban';
      const ready = status === 'ok' && (!isIban || ibanCheck === 'available');
      return <motion.li key={perk.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.08 }} className="panel flex flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground"><Icon className="h-5 w-5"/></span>
          <span className="mono-label rounded-full bg-secondary px-3 py-1.5 text-foreground">{formatPoints(perk.cost)}</span>
        </div>
        <h3 className="mt-5 text-lg font-medium">{ui.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ui.description}</p>
        {isIban && <p className="mt-3 font-mono text-xs text-muted-foreground">Your IBAN <span className="text-foreground">{iban}</span></p>}

        <AnimatePresence initial={false}>{isIban && expanded && status === 'ok' && <motion.div key="form" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden">
          <label htmlFor="new-iban" className="field-label mt-5">New IBAN</label>
          <input id="new-iban" value={newIban} onChange={e => setNewIban(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" autoComplete="off" maxLength={5} placeholder="12345" className="field font-mono text-xl tracking-[0.4em]"/>
          <p role="status" className="mt-2 flex h-5 items-center gap-1.5 text-sm">
            {ibanCheck === 'checking' && <><LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground"/><span className="text-muted-foreground">Checking…</span></>}
            {ibanCheck === 'available' && <><Check className="h-3.5 w-3.5 text-success"/><span className="text-success">That IBAN is free</span></>}
            {ibanCheck === 'taken' && <span className="text-destructive">That IBAN is taken</span>}
            {ibanCheck === 'self' && <span className="text-destructive">That's already your IBAN</span>}
            {ibanCheck === 'error' && <span className="text-destructive">Couldn't check that IBAN. Try again.</span>}
          </p>
        </motion.div>}</AnimatePresence>

        <div className="mt-auto pt-5">
          {status === 'owned' ? <span className="inline-flex h-11 items-center gap-2 rounded-full bg-success/10 px-5 text-sm font-medium text-success"><Check className="h-4 w-4"/>Owned</span>
          : status === 'points' ? <Button disabled className="h-11 rounded-full px-5 text-sm">Need {formatPoints(shortfall(state.balance, perk.cost))} more</Button>
          : isIban && !expanded ? <Button onClick={() => setOpen(perk.id)} disabled={busy || confirming} className="h-11 rounded-full px-5 text-sm">Choose an IBAN</Button>
          : <Button onClick={() => start(isIban ? { perkId: perk.id, iban: newIban } : { perkId: perk.id })} disabled={!ready || busy || confirming} className="h-11 rounded-full px-5 text-sm">{busy ? 'Unlocking…' : `Confirm with Face ID · ${formatPoints(perk.cost)}`}</Button>}
          {isIban && expanded && status === 'ok' && <button type="button" onClick={() => { setOpen(null); setNewIban(''); }} className="ml-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Cancel</button>}
        </div>
      </motion.li>;
    })}</ul>
    {!perks.some(p => owns(state, p.id)) && perks.length === 0 && <p className="mt-6 text-center text-sm text-muted-foreground">New perks are on the way.</p>}
    <FaceId open={confirming} successOnly onSuccess={() => void submit()} onCancel={() => { pending.current = null; setConfirming(false); }}/>
  </section>;
}
