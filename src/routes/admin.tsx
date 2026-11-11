import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Eye, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLoading } from '@/components/perk/AppShell';
import { PerkLogo } from '@/components/perk/PerkCard';
import { TransactionList } from '@/components/perk/TransactionList';
import { EASE } from '@/components/perk/motion';
import { getEmployeePanelData, getEmployeePanelState, lockEmployeePanel, unlockEmployeePanel } from '@/lib/employee-panel.functions';
import { formatMoney } from '@/lib/categories';

export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [{ title: 'Employee panel — Perk' }, { name: 'description', content: 'Staff access.' }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: EmployeePanel,
});

const STATE = ['employee-panel-state'];
const DATA = ['employee-panel-data'];

/** Staff view of the bank, behind a shared password. Read-only: no approving, no declining, no editing. */
export function EmployeePanel() {
  const qc = useQueryClient();
  const getState = useServerFn(getEmployeePanelState);
  const unlock = useServerFn(unlockEmployeePanel);
  const lock = useServerFn(lockEmployeePanel);
  const getData = useServerFn(getEmployeePanelData);
  const status = useQuery({ queryKey: STATE, queryFn: () => getState(), retry: false });
  const unlocked = status.data?.unlocked === true;
  const data = useQuery({ queryKey: DATA, queryFn: () => getData(), enabled: unlocked, refetchInterval: 20_000, retry: false });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // A session that ran out while the page was open goes back to the password screen.
  useEffect(() => { if (data.error) void qc.invalidateQueries({ queryKey: STATE }); }, [data.error, qc]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true); setMessage(null);
    try {
      const r = await unlock({ data: { password } });
      if (r.ok) { setPassword(''); await qc.invalidateQueries({ queryKey: STATE }); }
      else if (r.reason === 'locked') setMessage(`Too many wrong attempts. Try again in ${Math.max(1, Math.ceil(r.retryAfterSeconds / 60))} minute${r.retryAfterSeconds > 90 ? 's' : ''}.`);
      else if (r.reason === 'not_configured') setMessage('The employee panel is not set up yet. Ask the manager.');
      else { setMessage("That password isn't right."); setPassword(''); }
    } catch { setMessage('Something went wrong. Try again.'); }
    finally { setBusy(false); }
  }
  async function leave() { await lock(); qc.removeQueries({ queryKey: DATA }); await qc.invalidateQueries({ queryKey: STATE }); }

  if (status.isLoading) return <AppLoading label="Opening the employee panel…"/>;

  if (!unlocked) return <div className="flex min-h-dvh items-center justify-center px-5 py-10 text-foreground">
    <motion.form onSubmit={submit} className="w-full max-w-[400px]" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }} aria-label="Employee panel sign in">
      <a href="/" aria-label="Perk home"><PerkLogo className="text-4xl"/></a>
      <span className="mono-label mt-12 block text-foreground/60">Staff only</span>
      <h1 className="mt-3 text-[40px] font-medium leading-[1]">Employee <span className="serif-accent">panel.</span></h1>
      <p className="mt-3 text-sm text-foreground/70">Enter the staff password to continue.</p>
      <div className="panel mt-8 p-6">
        <label htmlFor="panel-password" className="field-label"><Lock className="h-3.5 w-3.5"/> Password</label>
        <input id="panel-password" name="employee-panel-password" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="field" placeholder="••••••••" autoFocus/>
        <p role="alert" className="mt-3 min-h-5 text-sm text-destructive">{status.data?.configured === false ? 'The employee panel is not set up yet. Ask the manager.' : message}</p>
      </div>
      <Button disabled={busy || !password || status.data?.configured === false} className="mt-3 h-12 w-full rounded-full bg-ink text-base font-medium text-bone hover:bg-ink/85 disabled:opacity-40">{busy ? 'Checking…' : 'Open the panel'}</Button>
    </motion.form>
  </div>;

  if (data.isLoading) return <AppLoading label="Loading…"/>;
  if (!data.data) return <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center text-foreground" role="alert">
    <PerkLogo className="text-4xl"/><p className="max-w-xs text-foreground/70">The staff view couldn't load. Try again in a moment.</p>
    <div className="flex gap-2"><Button onClick={() => void data.refetch()} className="h-11 rounded-full px-6">Try again</Button><Button variant="ghost" onClick={() => void leave()} className="h-11 rounded-full px-5">Lock</Button></div>
  </div>;
  const { users, txns, orders } = data.data;
  return <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
    <header className="flex items-center justify-between py-6"><a href="/" aria-label="Perk home"><PerkLogo className="text-3xl"/></a><Button variant="ghost" onClick={() => void leave()} className="h-10 rounded-full px-4 text-foreground hover:bg-foreground/10"><Lock className="h-4 w-4"/>Lock</Button></header>
    <span className="mono-label mt-6 block text-foreground/60">Employee panel</span>
    <h1 className="mt-3 text-[clamp(40px,6vw,64px)] font-medium leading-[0.95]">Staff <span className="serif-accent">view.</span></h1>
    <p className="mt-4 flex max-w-xl items-start gap-2 text-sm text-foreground/70"><Eye className="mt-0.5 h-4 w-4 flex-none"/>Read-only. Approving or declining trades and changing balances or transactions is reserved for the manager.</p>

    <section className="mt-10" aria-label="All balances"><h2 className="mb-4 text-2xl font-medium">All balances</h2>
      <div className="divide-y divide-border rounded-3xl bg-card text-card-foreground shadow-[0_0_0_1px_var(--border)]">{users.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No accounts yet.</p> : users.map(u => <div key={u.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="font-semibold">{u.full_name}</p><p className="mt-1 text-xs text-muted-foreground">IBAN {u.iban}</p></div><p className="text-xl font-bold tabular-nums">{formatMoney(u.balance)}</p></div>)}</div></section>

    <section className="mt-10" aria-label="All transactions"><h2 className="mb-4 text-2xl font-medium">All transactions</h2>
      <TransactionList txns={txns.map(t => ({ ...t, note: t.note ? `${t.owner} · ${t.note}` : t.owner }))}/></section>

    <section className="mt-10" aria-label="Settled orders"><h2 className="mb-4 text-2xl font-medium">Settled orders</h2>
      <div className="divide-y divide-border rounded-3xl bg-card text-card-foreground shadow-[0_0_0_1px_var(--border)]">{orders.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No settled orders yet.</p> : orders.map(o => <div key={o.id} className="flex flex-wrap justify-between gap-3 px-5 py-4"><span>{o.owner}</span><span>{formatMoney(o.amount)} · {o.multiplier.toFixed(1)}×</span><span className={o.status === 'success' ? 'text-success' : 'text-destructive'}>{o.status} · {formatMoney(o.payout)} returned</span></div>)}</div></section>
  </div>;
}
