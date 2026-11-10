import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { lookupRecipient, sendMoney } from "@/lib/account.functions";
import { formatMoney } from "@/lib/categories";

type Recipient = { iban: string; full_name: string; self: boolean };

export function SendMoney({ balance, onSent }: { balance: number; onSent: () => void }) {
  const lookup = useServerFn(lookupRecipient);
  const send = useServerFn(sendMoney);
  const [iban, setIban] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const value = Number(amount);

  async function find() {
    if (iban.trim().length !== 5 || busy) return;
    setBusy(true);
    setNotFound(false);
    setRecipient(null);
    try {
      const r = await lookup({ data: { iban: iban.trim() } });
      if (r.found) setRecipient({ iban: r.iban, full_name: r.full_name, self: r.self });
      else setNotFound(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!recipient || recipient.self || !(value > 0) || busy) return;
    if (value > balance) { toast.error("That's more than your balance"); return; }
    setBusy(true);
    try {
      await send({ data: { iban: recipient.iban, amount: Math.round(value * 100) / 100, note: note.trim() || undefined } });
      toast.success(`Sent ${formatMoney(value)} to ${recipient.iban}`);
      onSent();
      setAmount("");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="text-card-foreground" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div className="panel p-6 sm:p-8">
        <label htmlFor="recipient-iban" className="field-label">Recipient IBAN</label>
        <div className="flex gap-2">
          <input
            id="recipient-iban"
            value={iban}
            onChange={(e) => { setIban(e.target.value.replace(/\D/g, "").slice(0, 5)); setRecipient(null); setNotFound(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void find(); } }}
            placeholder="12345" maxLength={5} inputMode="numeric" autoComplete="off" className="field flex-1 font-mono text-xl tracking-[0.4em]"
          />
          <Button type="button" onClick={find} disabled={busy || iban.trim().length !== 5} className="h-14 rounded-2xl bg-ink px-6 text-sm font-medium text-bone hover:bg-ink/85 disabled:opacity-30">Find</Button>
        </div>
        <AnimatePresence mode="wait">
          {notFound && <motion.p key="nf" {...reveal} className="mt-3 text-sm text-destructive">No one found with that IBAN.</motion.p>}
          {recipient && (
            <motion.div key={recipient.iban} {...reveal} className="mt-3">
              {recipient.self
                ? <p className="text-sm text-destructive">That's you — pick someone else.</p>
                : <div className="flex items-center gap-3 rounded-2xl bg-bone p-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-court font-medium text-white">{recipient.full_name.slice(0, 1)}</span><span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">Sending to</span><strong className="block truncate font-medium">{recipient.full_name}</strong></span><span className="font-mono text-xs text-muted-foreground">{recipient.iban}</span><Check className="h-4 w-4 text-success"/></div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="panel mt-3 p-6 sm:p-8">
        <label htmlFor="send-amount" className="field-label">Amount ($)</label>
        <div className="flex items-baseline gap-1 border-b border-border pb-3 focus-within:border-ink">
          <span className="text-[44px] font-medium leading-none tracking-[-0.05em] text-muted-foreground">$</span>
          <input id="send-amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="0.01" placeholder="0.00" inputMode="decimal" className="w-full min-w-0 bg-transparent text-[56px] font-medium leading-none tracking-[-0.05em] outline-none tabular-nums placeholder:text-ink/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        </div>
        <div className="mt-3 text-xs text-muted-foreground">Balance: <span className="tabular-nums text-ink">{formatMoney(balance)}</span></div>
        <label htmlFor="send-note" className="field-label mt-8">Note (optional)</label>
        <input id="send-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="What's it for?" className="field" />
      </div>

      <Button type="submit" disabled={busy || !recipient || recipient.self || !(value > 0)} className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-court text-base font-medium text-white hover:bg-[#2c56b0] disabled:opacity-35">
        <ArrowUpRight className="h-5 w-5" />{busy ? "Sending…" : value > 0 ? `Send ${formatMoney(value)}` : "Send"}
      </Button>
    </form>
  );
}

const reveal = { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } };
