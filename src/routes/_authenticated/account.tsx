import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Copy, LogOut, ShieldCheck, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PerkLogo } from '@/components/perk/PerkCard';
import { UnlockFlow } from '@/components/perk/UnlockFlow';
import { TransactionList } from '@/components/perk/TransactionList';
import { Receipt } from '@/components/perk/Receipt';
import { Invest } from '@/components/perk/Invest';
import { Leaderboard } from '@/components/perk/Leaderboard';
import { LiveInvestments } from '@/components/perk/LiveInvestments';
import { ProfilePhoto } from '@/components/perk/ProfilePhoto';
import { AccountNavigation, type AccountView } from '@/components/perk/AccountNavigation';
import { AppError, AppLoading, ViewTransition } from '@/components/perk/AppShell';
import { CountUp, EASE } from '@/components/perk/motion';
import { getAccountData, lockAccount } from '@/lib/account.functions';
import type { Txn } from '@/lib/bank';
import { formatMoney } from '@/lib/categories';

export const Route = createFileRoute('/_authenticated/account')({
  validateSearch: (search: Record<string, unknown>): { view?: AccountView } => ({ view: search['view'] === 'invest' || search['view'] === 'leaderboard' || search['view'] === 'perks' ? search['view'] : 'home' }),
  head: () => ({ meta: [{ title: 'Your account — Perk' }, { name: 'description', content: 'Your Perk balance, investments, transfers and perks.' }, { property: 'og:title', content: 'Your account — Perk' }, { property: 'og:description', content: 'Your balance and transactions, beautifully simple.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AccountPage,
});

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

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
  const first = profile.full_name.split(' ')[0];
  const month = new Date(); const monthTxns = txns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear(); });
  const moneyIn = monthTxns.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const moneyOut = monthTxns.filter(t => t.amount < 0).reduce((a, t) => a + t.amount, 0);
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
          <div className="grid gap-4">
          <section className="panel-ink balance-panel relative overflow-hidden p-7 sm:p-9" aria-label="Balance">
            <div className="relative">
              <p className="text-[15px] text-bone/70">{greeting()}, <span className="text-bone">{first}</span></p>
              <p className="mono-label mt-10 text-bone/45">Your balance</p>
              <h1 className="balance-figure mt-3"><CountUp value={account.balance} split/></h1>
              <button type="button" className="iban-chip mt-6" aria-label={`Copy IBAN ${profile.iban ?? ''}`} onClick={async () => { try { await navigator.clipboard.writeText(profile.iban ?? ''); toast.success('IBAN copied'); } catch { toast.error('Unable to copy IBAN'); } }}>IBAN <strong>{profile.iban}</strong><Copy className="h-3.5 w-3.5"/></button>
              <div className="mt-10 grid grid-cols-2 gap-2">
                <Link to="/send" className="action-btn action-court"><ArrowUpRight/>Send money</Link>
                <Link to="/account" search={{ view: 'invest' }} className="action-btn action-bone"><TrendingUp/>Invest</Link>
              </div>
            </div>
          </section>
          <LiveInvestments orders={orders} clockOffset={offsetRef.current ?? 0}/>
          </div>

          <section className="panel p-3 sm:p-4" aria-label="Transactions">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-4 pt-3">
              <h2 className="text-xl font-medium">Transactions</h2>
              <div role="tablist" aria-label="Filter transactions" className="relative flex rounded-full bg-bone p-1">
                {(['all', 'in', 'out'] as const).map(f => <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`relative z-10 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${filter === f ? 'text-ink' : 'text-muted-foreground hover:text-ink'}`}>
                  {filter === f && <motion.span layoutId="txn-filter" className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_0_0_1px_var(--border)]" transition={{ type: 'spring', stiffness: 420, damping: 36 }}/>}
                  {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
                </button>)}
              </div>
            </div>
            <div className="mx-3 mb-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-bone/70 px-4 py-3"><p className="mono-label text-muted-foreground">In · this month</p><p className="mt-1 text-lg font-medium tabular-nums text-success">{formatMoney(moneyIn, true)}</p></div>
              <div className="rounded-2xl bg-bone/70 px-4 py-3"><p className="mono-label text-muted-foreground">Out · this month</p><p className="mt-1 text-lg font-medium tabular-nums">{formatMoney(moneyOut, true)}</p></div>
            </div>
            <div className="px-1 pb-1">{shown.length ? <TransactionList key={filter} txns={shown} onSelect={setSelected} flat/> : <p className="py-12 text-center text-sm text-muted-foreground">Nothing here yet.</p>}</div>
          </section>
        </ViewTransition>
        : view === 'invest' ? <ViewTransition id="invest"><Invest balance={account.balance} onPlaced={() => { refresh(); void navigate({ to: '/account', search: { view: 'home' } }); }}/></ViewTransition>
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
