import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { AppError, AppLoading, ViewTransition } from '@/components/perk/AppShell';
import { EASE } from '@/components/perk/motion';
import { useGlideHold } from '@/components/perk/useGlideHold';
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
  if (isLoading) return <AppLoading label="Opening payments…"/>;
  if (error || !data) return <AppError message="Payments couldn't load." action={<Button onClick={refresh} className="h-11 rounded-full px-6">Try again</Button>}/>;
  if (data.status === 'no_profile') return <Navigate to="/setup"/>;
  if (data.status === 'locked') return <UnlockFlow open onClose={() => void navigate({ to: '/account', search: { view: 'home' } })} onUnlocked={refresh}/>;
  return <div className="bank-page bank-fixed">
    <motion.header className="bank-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}><Link to="/" aria-label="Perk home"><PerkLogo className="text-[30px]"/></Link><Button asChild variant="ghost" className="h-10 rounded-full px-4 text-ink hover:bg-ink/5"><Link to="/account" search={{ view: 'home' }}><ArrowLeft className="h-4 w-4"/>Account</Link></Button></motion.header>
    <main className="bank-main"><ViewTransition id="send" className="mx-auto flex h-full w-full max-w-[940px] flex-col justify-center">
      <SendBody balance={data.account.balance} orders={data.orders} onSent={() => { refresh(); void navigate({ to: '/account', search: { view: 'home' } }); }}/>
    </ViewTransition></main>
    <AccountNavigation active="send"/>
  </div>;
}

/** The send form, showing the balance without a win whose chart is still playing out. */
function SendBody({ balance: rawBalance, orders, onSent }: { balance: number; orders: Parameters<typeof useGlideHold>[0]; onSent: () => void }) {
  const { heldPayout } = useGlideHold(orders);
  const balance = rawBalance - heldPayout;
  return <div className="flex flex-col gap-3">
    <header className="mb-1 flex items-end justify-between gap-4 px-1">
      <div>
        <span className="mono-label hidden text-muted-foreground [@media(min-height:720px)]:inline">Payments</span>
        <h1 className="mt-1 text-[clamp(28px,5dvh,44px)] font-medium leading-[1.05]">Send <span className="serif-accent">money.</span></h1>
      </div>
      <p className="pb-1 text-right text-[13px] text-muted-foreground">Available balance<span className="block text-[17px] font-medium text-ink tabular-nums">{formatMoney(balance)}</span></p>
    </header>
    <SendMoney balance={balance} onSent={onSent}/>
  </div>;
}
