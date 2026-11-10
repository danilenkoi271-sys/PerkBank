import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Copy, LoaderCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { isPreparing, prepStage } from '@/lib/live-trade';
import { useGlideHold } from './useGlideHold';
import { CountUp, EASE } from './motion';
import { Position, useLivePositions, type LiveOrderRow } from './LiveInvestments';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * The balance card doubles as the live trade view. While a trade runs, the greeting slides to the top right, the
 * balance and IBAN shrink into the top left, the buttons fold away and the card grows downward to hold the live
 * chart. When the trade is over everything slides back. The morph is driven purely by `data-trading` in CSS.
 */
export function BalanceCard({ balance, firstName, iban, orders, clockOffset }: { balance: number; firstName: string; iban: string; orders: LiveOrderRow[]; clockOffset: number }) {
  const { visible, now } = useLivePositions(orders, clockOffset);
  // A new trade is first "prepared" for 5 to 15 seconds; only then does the card morph into the live view.
  const preparing = visible.find(o => isPreparing(o, now));
  const trading = visible.length > 0 && !preparing;
  const busy = visible.length > 0; // any active trade keeps the buttons replaced
  const stage = preparing ? prepStage(preparing, now - Date.parse(preparing.created_at)) : { label: 'Order placed', done: true };
  // A win is only revealed once its chart has finished, so the credited amount is held back until then.
  const { heldPayout } = useGlideHold(orders, clockOffset);
  // Keep the last positions around so the chart content stays put while the card folds back.
  const last = useRef<LiveOrderRow[]>([]);
  if (trading) last.current = visible;
  const positions = trading ? visible : last.current;

  return <section className="panel-ink balance-panel morph relative overflow-hidden" data-trading={trading} aria-label="Balance">
    <div className="morph-head">
      <p className="morph-greet text-bone/70">{greeting()}, <span className="text-bone">{firstName}</span></p>
      <p className="morph-label mono-label text-bone/45">Your balance</p>
      <h1 className="morph-figure"><CountUp value={balance - heldPayout} split/></h1>
      <button type="button" className="morph-iban iban-chip" aria-label={`Copy IBAN ${iban}`} onClick={async () => { try { await navigator.clipboard.writeText(iban); toast.success('IBAN copied'); } catch { toast.error('Unable to copy IBAN'); } }}>IBAN <strong>{iban}</strong><Copy className="h-3.5 w-3.5"/></button>
    </div>

    <div className="morph-actions" aria-hidden={trading} {...(trading ? { inert: true } : {})}>
      <div><div className="pt-10">
        <AnimatePresence mode="wait" initial={false}>
          {busy ? <motion.div key="thinking" role="status" aria-live="polite" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.45, ease: EASE }} className="flex h-[52px] items-center gap-3 rounded-full bg-white/[0.07] px-5 ring-1 ring-inset ring-white/10">
            <StatusIcon done={stage.done}/>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={stage.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }} className={stage.done ? 'text-[15px] text-[#4be08f]' : 'thinking-text text-[15px]'}>{stage.label}{stage.done ? '' : '…'}</motion.span>
            </AnimatePresence>
          </motion.div>
          : <motion.div key="buttons" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE }} className="grid grid-cols-2 gap-2">
            <Link to="/send" className="action-btn action-court"><ArrowUpRight/>Send money</Link>
            <Link to="/account" search={{ view: 'invest' }} className="action-btn action-bone"><TrendingUp/>Invest</Link>
          </motion.div>}
        </AnimatePresence>
      </div></div>
    </div>

    <div className="morph-trade" aria-hidden={!trading} {...(trading ? {} : { inert: true })}>
      <div><div className="-mx-4 px-4 pt-6">
        {positions.map((o, i) => <div key={o.id} className={i > 0 ? 'mt-6 border-t border-white/10 pt-6' : ''}><Position order={o} now={now}/></div>)}
      </div></div>
    </div>
  </section>;
}

/** A spinner while a step is working that turns into a tick when it is done, then back into a spinner for the next. */
function StatusIcon({ done }: { done: boolean }) {
  return <span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
    <AnimatePresence mode="wait" initial={false}>
      {done
        ? <motion.svg key="tick" viewBox="0 0 24 24" className="h-5 w-5" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
          <circle cx="12" cy="12" r="10" fill="#3ddc84" fillOpacity="0.16"/>
          <motion.path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#4be08f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}/>
        </motion.svg>
        : <motion.span key="spin" className="flex" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
          <LoaderCircle className="h-5 w-5 animate-spin text-[#7aa2ff]"/>
        </motion.span>}
    </AnimatePresence>
  </span>;
}
