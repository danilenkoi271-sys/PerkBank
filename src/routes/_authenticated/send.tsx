import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PerkLogo } from '@/components/perk/PerkCard';
import { AccountNavigation } from '@/components/perk/AccountNavigation';
import { SendMoney } from '@/components/perk/SendMoney';
import { UnlockFlow } from '@/components/perk/UnlockFlow';
import { getAccountData } from '@/lib/account.functions';
import { formatMoney } from '@/lib/categories';

export const Route = createFileRoute('/_authenticated/send')({
  head: () => ({ meta: [{ title: 'Send money — Perk' }, { name: 'description', content: 'Send a payment to another Perk account using their five-digit IBAN.' }, { property: 'og:title', content: 'Send money — Perk' }, { property: 'og:description', content: 'Simple payments between Perk accounts.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: SendPage,
});
function SendPage() {
  const qc = useQueryClient(); const fetch = useServerFn(getAccountData); const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['account-data'], queryFn: () => fetch() });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['account-data'] });
  if (isLoading) return <div className="bank-loading">Opening payments…</div>;
  if (error || !data) return <div className="bank-loading"><p>Payments couldn't load.</p><Button onClick={refresh}>Try again</Button></div>;
  if (data.status === 'no_profile') return <Navigate to="/setup"/>;
  if (data.status === 'locked') return <UnlockFlow open onClose={() => void navigate({ to: '/account', search: { view: 'home' } })} onUnlocked={refresh}/>;
  return <div className="bank-page"><header className="bank-header"><Link to="/" aria-label="Perk home"><PerkLogo className="text-3xl"/></Link><Button asChild variant="ghost" className="bank-header-control"><Link to="/account" search={{ view: 'home' }}><ArrowLeft className="h-4 w-4"/>Account</Link></Button></header>
    <section className="bank-send-heading"><p className="text-sm text-foreground/75">PAYMENTS</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Send money.</h1><p className="mt-4 text-sm text-foreground/75">Available balance <span className="ml-2 font-semibold text-foreground">{formatMoney(data.account.balance)}</span></p></section>
    <main className="bank-content"><div className="bank-send-form"><SendMoney balance={data.account.balance} onSent={() => { refresh(); void navigate({ to: '/account', search: { view: 'home' } }); }}/></div></main><AccountNavigation active="send"/>
  </div>;
}