import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Info, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PerkLogo } from '@/components/perk/PerkCard';
import { UnlockFlow } from '@/components/perk/UnlockFlow';
import { TransactionList } from '@/components/perk/TransactionList';
import { Receipt } from '@/components/perk/Receipt';
import { Invest } from '@/components/perk/Invest';
import { Leaderboard } from '@/components/perk/Leaderboard';
import { BalanceCard } from '@/components/perk/BalanceCard';
import { ProfilePhoto } from '@/components/perk/ProfilePhoto';
import { AccountNavigation, type AccountView } from '@/components/perk/AccountNavigation';
import { AppError, AppLoading, ViewTransition } from '@/components/perk/AppShell';
import { EASE } from '@/components/perk/motion';
import { useGlideHold } from '@/components/perk/useGlideHold';
import { getAccountData, lockAccount } from '@/lib/account.functions';
import { getPerks } from '@/lib/perks.functions';
import { maxMultiplierOf, type PerkState } from '@/lib/perks';
import { PerksShop } from '@/components/perk/PerksShop';
import { BotInfo } from '@/components/perk/BotInfo';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Txn } from '@/lib/bank';

export const Route = createFileRoute('/_authenticated/account')({
  validateSearch: (search: Record<string, unknown>): { view?: AccountView } => ({ view: search['view'] === 'invest' || search['view'] === 'leaderboard' || search['view'] === 'perks' ? search['view'] : 'home' }),
  head: () => ({ meta: [{ title: 'Your account — Perk' }, { name: 'description', content: 'Your Perk balance, investments, transfers and perks.' }, { property: 'og:title', content: 'Your account — Perk' }, { property: 'og:description', content: 'Your balance and transactions, beautifully simple.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AccountPage,
});

function AccountPage() {
  const qc = useQueryClient(); const fetch = useServerFn(getAccountData); const lock = useServerFn(lockAccount); const navigate = useNavigate();
  const view = Route.useSearch().view ?? 'home'; const [selected, setSelected] = useState<Txn | null>(null); const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading, error, dataUpdatedAt } = useQuery({ queryKey: ['account-data'], queryFn: () => fetch(), refetchInterval: q => q.state.data?.status === 'ready' && q.state.data.orders.some(o => o.status === 'pending') ? 4000 : 15000 });
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  // Server time minus device time. The least-delayed reading is the most accurate, so only ever raise it.
  const offsetRef = useRef<number | null>(null);
  if (data?.status === 'ready' && dataUpdatedAt) { const o = data.serverNow - dataUpdatedAt; if (offsetRef.current === null || o > offsetRef.current) offsetRef.current = o; }
  // Perk points are loaded on their own so a problem there can never affect the account itself.
  const fetchPerks = useServerFn(getPerks);
  const perksQuery = useQuery({ queryKey: ['perks'], queryFn: () => fetchPerks(), retry: false, enabled: view === 'perks' || view === 'invest' });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['account-data'] }); void qc.invalidateQueries({ queryKey: ['leaderboard'] }); void qc.invalidateQueries({ queryKey: ['perks'] }); };
  if (isLoading) return <AppLoading label="Opening Perk…"/>;
  if (error || !data) return <AppError message="We couldn't open your account." action={<Button onClick={refresh} className="h-11 rounded-full px-6">Try again</Button>}/>;
  if (data.status === 'no_profile') return <Navigate to="/setup"/>;
  if (data.status === 'locked') return <UnlockFlow open onClose={() => void navigate({ to: '/' })} onUnlocked={refresh}/>;
  const { account, profile, txns, orders, isAdmin } = data;
  const first = profile.full_name.split(' ')[0] ?? profile.full_name;

  // Home and invest fit one screen; the league (a long list) scrolls like a normal page.
  return <div className={`bank-page ${view === 'home' || view === 'invest' ? 'bank-fixed' : ''}`}>
    <motion.header className="bank-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <Link to="/" aria-label="Perk home"><PerkLogo className="text-[30px]"/></Link>
      <div className="flex items-center gap-1.5">
        {view === 'invest' && <Button variant="ghost" size="icon" aria-label="About the trading bot" title="About the trading bot" className="bank-header-control" onClick={() => setInfoOpen(true)}><Info className="h-[18px] w-[18px]"/></Button>}
        {isAdmin && <Button asChild variant="ghost" size="icon" aria-label="Administration" className="bank-header-control"><Link to="/manage"><ShieldCheck className="h-[18px] w-[18px]"/></Link></Button>}
        <Button variant="ghost" size="icon" aria-label="Lock account" className="bank-header-control" onClick={async () => { await lock(); refresh(); }}><LogOut className="h-[18px] w-[18px]"/></Button>
        <span className="ml-1.5"><ProfilePhoto name={profile.full_name} url={profile.avatar_url} onSaved={refresh}/></span>
      </div>
    </motion.header>

    <main className="bank-main">
      <AnimatePresence mode="wait" initial={false}>
        {view === 'home' ? <ViewTransition id="home" className="home-grid">
          <BalanceCard balance={account.balance} firstName={first} iban={profile.iban ?? ''} orders={orders} clockOffset={offsetRef.current ?? 0}/>

          <TransactionsPanel txns={txns} orders={orders} clockOffset={offsetRef.current ?? 0} filter={filter} setFilter={setFilter} onSelect={setSelected}/>
        </ViewTransition>
        : view === 'invest' ? <ViewTransition id="invest" className="h-full"><Invest balance={account.balance} maxMultiplier={maxMultiplierOf(perksQuery.data)} orders={orders} clockOffset={offsetRef.current ?? 0} onPlaced={() => { refresh(); void navigate({ to: '/account', search: { view: 'home' } }); }}/></ViewTransition>
        : view === 'leaderboard' ? <ViewTransition id="leaderboard"><Leaderboard/></ViewTransition>
        : <ViewTransition id="perks"><PerksView query={perksQuery} iban={profile.iban ?? ''} onChanged={refresh}/></ViewTransition>}
      </AnimatePresence>
    </main>
    <BotInfo open={infoOpen} onClose={() => setInfoOpen(false)} maxMultiplier={maxMultiplierOf(perksQuery.data)}/>
    <AccountNavigation active={view}/><Receipt txn={selected} iban={profile.iban ?? ''} holder={profile.full_name} trade={selected?.order_id ? orders.find(o => o.id === selected.order_id) ?? null : null} onClose={() => setSelected(null)}/>
  </div>;
}

function PerksView({ query, iban, onChanged }: { query: UseQueryResult<PerkState>; iban: string; onChanged: () => void }) {
  if (query.isLoading) return <section className="panel-ink mx-auto flex min-h-[50vh] max-w-[940px] items-center justify-center" aria-label="Perks" role="status"><span className="flex gap-1.5"><span className="loader-dot"/><span className="loader-dot"/><span className="loader-dot"/></span><span className="sr-only">Loading perks</span></section>;
  if (query.error || !query.data) return <section className="panel-ink mx-auto flex min-h-[50vh] max-w-[940px] flex-col items-center justify-center gap-4 px-8 text-center" aria-label="Perks">
    <h1 className="text-3xl font-medium">Perks are on the way</h1>
    <p className="max-w-sm text-bone/60">The perks shop is opening soon. Your points are safe and will be waiting for you.</p>
    <Button onClick={() => void query.refetch()} className="mt-2 h-11 rounded-full bg-bone px-6 text-ink hover:bg-white">Try again</Button>
  </section>;
  return <PerksShop state={query.data} iban={iban} onChanged={onChanged}/>;
}

type Filter = 'all' | 'in' | 'out';
function TransactionsPanel({ txns, orders, clockOffset, filter, setFilter, onSelect }: { txns: (Txn & { order_id?: string | null })[]; orders: Parameters<typeof useGlideHold>[0]; clockOffset: number; filter: Filter; setFilter: (f: Filter) => void; onSelect: (t: Txn) => void }) {
  // The payout of a trade that is still playing out stays out of the list until its chart has finished.
  const { hiddenOrderIds } = useGlideHold(orders, clockOffset);
  const visible = txns.filter(t => !(t.category === 'investment_payout' && t.order_id && hiddenOrderIds.has(t.order_id)));
  const shown = filter === 'all' ? visible : visible.filter(t => filter === 'in' ? t.amount > 0 : t.amount < 0);
  return <section className="panel-ink txn-panel txn-fixed p-3 sm:p-4" aria-label="Transactions">
    <div className="flex flex-none flex-wrap items-center justify-between gap-3 px-3 pb-4 pt-3">
      <h2 className="text-xl font-medium">Transactions</h2>
      <div role="tablist" aria-label="Filter transactions" className="relative flex rounded-full bg-white/[0.07] p-1">
        {(['all', 'in', 'out'] as const).map(f => <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`relative z-10 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${filter === f ? 'text-ink' : 'text-bone/55 hover:text-bone'}`}>
          {filter === f && <motion.span layoutId="txn-filter" className="absolute inset-0 -z-10 rounded-full bg-bone" transition={{ type: 'spring', stiffness: 420, damping: 36 }}/>}
          {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
        </button>)}
      </div>
    </div>
    <div className="txn-scroll">{shown.length ? <TransactionList key={filter} txns={shown} onSelect={onSelect} flat/> : <p className="py-12 text-center text-sm text-bone/50">Nothing here yet.</p>}</div>
  </section>;
}
