import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowUpRight, Copy, Gift, LogOut, ShieldCheck, TrendingUp } from 'lucide-react';
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
import { getAccountData, lockAccount } from '@/lib/account.functions';
import type { Txn } from '@/lib/bank';
import { formatMoney } from '@/lib/categories';

export const Route = createFileRoute('/_authenticated/account')({
  validateSearch: (search: Record<string, unknown>): { view?: AccountView } => ({ view: search['view'] === 'invest' || search['view'] === 'leaderboard' || search['view'] === 'perks' ? search['view'] : 'home' }),
  head: () => ({ meta: [{ title: 'Your account — Perk' }, { name: 'description', content: 'Your Perk balance, investments, transfers and perks.' }, { property: 'og:title', content: 'Your account — Perk' }, { property: 'og:description', content: 'Your balance and transactions, beautifully simple.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AccountPage,
});
function AccountPage() {
  const qc = useQueryClient(); const fetch = useServerFn(getAccountData); const lock = useServerFn(lockAccount); const navigate = useNavigate();
  const view = Route.useSearch().view ?? 'home'; const [selected, setSelected] = useState<Txn | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['account-data'], queryFn: () => fetch(), refetchInterval: q => q.state.data?.status === 'ready' && q.state.data.orders.some(o => o.status === 'pending') ? 4000 : 15000 });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['account-data'] }); void qc.invalidateQueries({ queryKey: ['leaderboard'] }); };
  if (isLoading) return <div className="bank-loading">Opening Perk…</div>;
  if (error || !data) return <div className="bank-loading"><p>We couldn't open your account.</p><Button onClick={refresh}>Try again</Button></div>;
  if (data.status === 'no_profile') return <Navigate to="/setup"/>;
  if (data.status === 'locked') return <UnlockFlow open onClose={() => void navigate({ to: '/' })} onUnlocked={refresh}/>;
  const { account, profile, txns, orders, isAdmin } = data;
  return <div className="bank-page">
    <header className="bank-header"><Link to="/" aria-label="Perk home"><PerkLogo className="text-3xl"/></Link><div className="flex items-center gap-3">
      {isAdmin && <Button asChild variant="ghost" size="icon" aria-label="Administration" className="bank-header-control"><Link to="/manage"><ShieldCheck className="h-5 w-5"/></Link></Button>}
      <Button variant="ghost" size="icon" aria-label="Lock account" className="bank-header-control" onClick={async () => { await lock(); refresh(); }}><LogOut className="h-5 w-5"/></Button>
      <ProfilePhoto name={profile.full_name} url={profile.avatar_url} onSaved={refresh}/>
    </div></header>
    {view === 'home' ? <>
      <section className="bank-overview"><div><p className="bank-greeting">Hey, {profile.full_name.split(' ')[0]}<span aria-hidden="true">✦</span></p><p className="bank-balance-label">Your balance</p><h1 className="bank-balance">{formatMoney(account.balance)}</h1>
        <Button variant="ghost" className="bank-iban" onClick={async () => { try { await navigator.clipboard.writeText(profile.iban ?? ''); toast.success('IBAN copied'); } catch { toast.error('Unable to copy IBAN'); } }}>IBAN <span>{profile.iban}</span><Copy className="h-3.5 w-3.5"/></Button>
      </div><div className="bank-actions"><Button asChild className="bank-send"><Link to="/send"><ArrowUpRight className="h-5 w-5"/>Send money</Link></Button><Button asChild variant="ghost" className="bank-invest"><Link to="/account" search={{ view: 'invest' }}><TrendingUp className="h-5 w-5"/>Invest</Link></Button></div></section>
      <main className="bank-content"><div className="bank-content-inner"><section className="bank-activity"><div className="bank-activity-heading"><h2 className="text-xl font-bold">Transactions</h2></div>
        <LiveInvestments orders={orders}/>
        <div className="bank-activity-list"><TransactionList txns={txns} onSelect={setSelected} flat/></div>
      </section></div></main>
    </> : <main className="bank-secondary">{view === 'invest' ? <Invest balance={account.balance} onPlaced={() => { refresh(); void navigate({ to: '/account', search: { view: 'home' } }); }}/> : view === 'leaderboard' ? <Leaderboard/> : <section className="bank-perks"><Gift className="h-9 w-9 text-foreground/70"/><h1 className="mt-6 text-4xl font-bold">Perks</h1><p className="mt-3 text-foreground/75">Temporarily unavailable</p></section>}</main>}
    <AccountNavigation active={view}/><Receipt txn={selected} iban={profile.iban ?? ''} holder={profile.full_name} onClose={() => setSelected(null)}/>
  </div>;
}