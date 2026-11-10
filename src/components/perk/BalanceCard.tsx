import { useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Copy, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { CountUp } from './motion';
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
  const trading = visible.length > 0;
  // Keep the last positions around so the chart content stays put while the card folds back.
  const last = useRef<LiveOrderRow[]>([]);
  if (trading) last.current = visible;
  const positions = trading ? visible : last.current;

  return <section className="panel-ink balance-panel morph relative overflow-hidden" data-trading={trading} aria-label="Balance">
    <div className="morph-head">
      <p className="morph-greet text-bone/70">{greeting()}, <span className="text-bone">{firstName}</span></p>
      <p className="morph-label mono-label text-bone/45">Your balance</p>
      <h1 className="morph-figure"><CountUp value={balance} split/></h1>
      <button type="button" className="morph-iban iban-chip" aria-label={`Copy IBAN ${iban}`} onClick={async () => { try { await navigator.clipboard.writeText(iban); toast.success('IBAN copied'); } catch { toast.error('Unable to copy IBAN'); } }}>IBAN <strong>{iban}</strong><Copy className="h-3.5 w-3.5"/></button>
    </div>

    <div className="morph-actions" aria-hidden={trading} {...(trading ? { inert: true } : {})}>
      <div><div className="grid grid-cols-2 gap-2 pt-10">
        <Link to="/send" className="action-btn action-court"><ArrowUpRight/>Send money</Link>
        <Link to="/account" search={{ view: 'invest' }} className="action-btn action-bone"><TrendingUp/>Invest</Link>
      </div></div>
    </div>

    <div className="morph-trade" aria-hidden={!trading} {...(trading ? {} : { inert: true })}>
      <div><div className="-mx-4 px-4 pt-6">
        {positions.map((o, i) => <div key={o.id} className={i > 0 ? 'mt-6 border-t border-white/10 pt-6' : ''}><Position order={o} now={now}/></div>)}
      </div></div>
    </div>
  </section>;
}
