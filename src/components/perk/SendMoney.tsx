import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { lookupRecipient, sendMoney } from "@/lib/account.functions";
import { formatMoney } from "@/lib/categories";

const field = "w-full rounded-lg border bg-card px-4 py-4 text-base text-card-foreground outline-none focus:ring-2 focus:ring-ring";

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
    <form className="space-y-7 text-card-foreground" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <div>
          <label htmlFor="recipient-iban" className="mb-2 block text-sm font-semibold text-muted-foreground">Recipient IBAN</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              
              <input
                id="recipient-iban"
                value={iban}
                onChange={(e) => { setIban(e.target.value.replace(/\D/g, "").slice(0, 5)); setRecipient(null); setNotFound(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") void find(); }}
                placeholder="12345" maxLength={5} inputMode="numeric" className={field}
              />
            </div>
            <Button type="button" onClick={find} disabled={busy || iban.trim().length !== 5} className="h-auto rounded-lg bg-muted px-5 text-sm font-semibold text-card-foreground hover:bg-muted/70">Find</Button>
          </div>
          {notFound && <p className="mt-2 text-sm text-destructive">No one found with that IBAN.</p>}
          {recipient && (
            <p className="mt-2 text-sm">
              {recipient.self
                ? <span className="text-destructive">That's you — pick someone else.</span>
                : <span>Sending to <strong>{recipient.full_name}</strong> <span className="text-muted-foreground">{recipient.iban}</span></span>}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="send-amount" className="mb-2 block text-sm font-semibold text-muted-foreground">Amount ($)</label>
          <input id="send-amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="0.01" placeholder="0.00" className={field} />
          <div className="mt-1 text-xs text-muted-foreground">Balance: {formatMoney(balance)}</div>
        </div>
        <div>
          <label htmlFor="send-note" className="mb-2 block text-sm font-semibold text-muted-foreground">Note (optional)</label>
          <input id="send-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="What's it for?" className={field} />
        </div>
        <Button type="submit" disabled={busy || !recipient || recipient.self || !(value > 0)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sky font-semibold text-primary-foreground hover:bg-sky/90 disabled:opacity-50">
          <ArrowUpRight className="h-4 w-4" />{busy ? "Sending…" : "Send"}
        </Button>
    </form>
  );
}
