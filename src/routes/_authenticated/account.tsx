import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, ShieldCheck } from 'lucide-react';
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
import { getAccountData, lockAccount } from '@/lib/account.functions';
import type { Txn } from '@/lib/bank';

export const Route = createFileRoute('/_authenticated/account')({
  validateSearch: (search: Record<string, unknown>): { view?: AccountView } => ({ view: search['view'] === 'invest' || search['view'] === 'leaderboard' || search['view'] === 'perks' ? search['view'] : 'home' }),
  head: () => ({ meta: [{ title: 'Your account — Perk' }, { name: 'description', content: 'Your Perk balance, investments, transfers and perks.' }, { property: 'og:title', content: 'Your account — Perk' }, { property: 'og:description', content: 'Your balance and transactions, beautifully simple.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AccountPage,
});

function AccountPage() {
  const qc = useQueryClient(); const fetch = useServerFn(getAccountData); const lock = useServerFn(lockAccount); const navigate = useNavigate();
  const view = Route.useSearch().view ?? 'home'; const [selected, setSelected] = useState<Txn | null>(null);
  const { data, isLoading, error, dataUpdatedAt } = useQuery({ queryKey: ['account-data'], queryFn: () => fetch(), refetchInterval: q => q.state.data?.status === 'ready' && q.state.data.orders.some(o => o.status === 'pending') ? 4000 : 15000 });
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  // Server time minus device time. The least-delayed reading is the most accurate, so only ever raise it.
  const offsetRef = useRef<number | null>(null);
  if (data?.status === 'ready' && dataUpdatedAt) { const o = data.serverNow - dataUpdatedAt; if (offsetRef.current === null || o > offsetRef.current) offsetRef.current = o; }
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['account-data'] }); void qc.invalidateQueries({ queryKey: ['leaderboard'] }); };
  if (isLoading) return <AppLoading label="Opening Perk…"/>;
  if (error || !data) return <AppError message="We couldn't open your account." action={<Button onClick={refresh} className="h-11 rounded-full px-6">Try again</Button>}/>;
  if (data.status === 'no_profile') return <Navigate to="/setup"/>;
  if (data.status === 'locked') return <UnlockFlow open onClose={() => void navigate({ to: '/' })} onUnlocked={refresh}/>;
  const { account, profile, txns, orders, isAdmin } = data;
  const first = profile.full_name.split(' ')[0] ?? profile.full_name;
  const shown = filter === 'all' ? txns : txns.filter(t => filter === 'in' ? t.amount > 0 : t.amount < 0);

  return <div className="bank-page">
    <motion.header className="bank-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <Link to="/" aria-label="Perk home"><PerkLogo className="text-[30px]"/></Link>
      <div className="flex items-center gap-1.5">
        {isAdmin && <Button asChild variant="ghost" size="icon" aria-label="Administration" className="bank-header-control"><Link to="/manage"><ShieldCheck className="h-[18px] w-[18px]"/></Link></Button>}
        <Button variant="ghost" size="icon" aria-label="Lock account" className="bank-header-control" onClick={async () => { await lock(); refresh(); }}><LogOut className="h-[18px] w-[18px]"/></Button>
        <span className="ml-1.5"><ProfilePhoto name={profile.full_name} url={profile.avatar_url} onSaved={refresh}/></span>
      </div>
    </motion.header>

    <main className="bank-main">
      <AnimatePresence mode="wait" initial={false}>
        {view === 'home' ? <ViewTransition id="home" className="home-grid">
          <BalanceCard balance={account.balance} firstName={first} iban={profile.iban ?? ''} orders={orders} clockOffset={offsetRef.current ?? 0}/>

          <section className="panel-ink txn-panel p-3 sm:p-4" aria-label="Transactions">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-5 pt-3">
              <h2 className="text-xl font-medium">Transactions</h2>
              <div role="tablist" aria-label="Filter transactions" className="relative flex rounded-full bg-white/[0.07] p-1">
                {(['all', 'in', 'out'] as const).map(f => <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`relative z-10 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${filter === f ? 'text-ink' : 'text-bone/55 hover:text-bone'}`}>
                  {filter === f && <motion.span layoutId="txn-filter" className="absolute inset-0 -z-10 rounded-full bg-bone" transition={{ type: 'spring', stiffness: 420, damping: 36 }}/>}
                  {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
                </button>)}
              </div>
            </div>
            <div className="pb-1">{shown.length ? <TransactionList key={filter} txns={shown} onSelect={setSelected} flat/> : <p className="py-12 text-center text-sm text-bone/50">Nothing here yet.</p>}</div>
          </section>
        </ViewTransition>
        : view === 'invest' ? <ViewTransition id="invest"><Invest balance={account.balance} orders={orders} clockOffset={offsetRef.current ?? 0} onPlaced={() => { refresh(); void navigate({ to: '/account', search: { view: 'home' } }); }}/></ViewTransition>
        : view === 'leaderboard' ? <ViewTransition id="leaderboard"><Leaderboard/></ViewTransition>
        : <ViewTransition id="perks"><Perks/></ViewTransition>}
      </AnimatePresence>
    </main>
    <AccountNavigation active={view}/><Receipt txn={selected} iban={profile.iban ?? ''} holder={profile.full_name} onClose={() => setSelected(null)}/>
  </div>;
}

function Perks() {
  return <section className="panel-ink relative mx-auto flex min-h-[60vh] max-w-[760px] flex-col items-center justify-center overflow-hidden px-8 py-20 text-center" aria-label="Perks">
    <div className="relative flex h-24 w-24 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-court/50 animate-pulse-ring"/>
      <span className="absolute inset-0 rounded-full bg-court/50 animate-pulse-ring [animation-delay:.9s]"/>
      <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-court font-logo text-5xl text-white">+</span>
    </div>
    <span className="mono-label mt-10 text-bone/50">Rewards & bonuses</span>
    <h1 className="mt-3 text-5xl font-medium">Perks</h1>
    <p className="mt-3 text-bone/60">Temporarily unavailable</p>
  </section>;
}
