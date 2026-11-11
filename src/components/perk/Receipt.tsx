import { X } from "lucide-react";
import { TxnIcon } from "./TxnIcon";
import { PerkLogo } from "./PerkCard";
import { formatMoney, getCategory } from "@/lib/categories";
import type { Txn } from "@/lib/bank";
import { Button } from '@/components/ui/button';

function Barcode({ value }: { value: string }) {
  const bars: number[] = [];
  for (const ch of value.repeat(3)) { const d = Number(ch) || 1; bars.push((d % 3) + 1, (d % 2) + 1); }
  let x = 0;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${bars.reduce((a, b) => a + b, 0)} 40`} preserveAspectRatio="none" className="h-16 w-56">
        {bars.map((w, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="40" fill="currentColor" /> : null; x += w; return r; })}
      </svg>
      <span className="mt-1 font-mono text-[11px] tracking-[0.3em] text-card-foreground">{value}</span>
    </div>
  );
}

const NOTCH = "radial-gradient(circle 12px at 0 100%, transparent 97%, #000) left / 51% 100% no-repeat, radial-gradient(circle 12px at 100% 100%, transparent 97%, #000) right / 51% 100% no-repeat";
const SCALLOP = "radial-gradient(circle 13px at 50% 100%, transparent 97%, #000) 0 0 / 44px 100% repeat-x";

/** `anonymous` leaves out the account holder and IBAN, for receipts shown to people other than the owner. */
export function Receipt({ txn, iban, holder, onClose, anonymous = false }: { txn: Txn | null; iban: string; holder: string; onClose: () => void; anonymous?: boolean }) {
  if (!txn) return null;
  const cat = getCategory(txn.category);
  const d = new Date(txn.created_at);
  const incoming = txn.amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div role="dialog" aria-label="Transaction receipt" className="compact-receipt relative w-full text-card-foreground animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close receipt" className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full bg-card text-card-foreground">
          <X className="h-4 w-4" />
        </Button>
        {/* Top stub */}
        <div className="relative rounded-t-[1.75rem] bg-card px-7 pb-6 pt-8 text-center" style={{ WebkitMask: NOTCH, mask: NOTCH }}>
          <PerkLogo className="mb-5 block text-2xl text-sky" />
          <div className="mb-3 flex justify-center"><TxnIcon icon={txn.icon} title={txn.title} category={txn.category} incoming={incoming} className="h-16 w-16 text-2xl" /></div>
          <h3 className="text-2xl font-bold">{incoming ? "Money in!" : "Payment sent"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{txn.title} · {cat.label}</p>
          <div className="absolute bottom-0 left-6 right-6 border-b-2 border-dashed border-border" />
        </div>
        {/* Details */}
        <div className="bg-card px-7 pb-6 pt-6">
          <div className="grid grid-cols-2 gap-y-5 text-sm">
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Transaction ID</div><div className="mt-1 font-semibold">{txn.reference}</div></div>
            <div className="text-right"><div className="text-xs text-muted-foreground">Amount</div><div className={`mt-1 font-bold ${incoming ? "text-success" : ""}`}>{formatMoney(txn.amount, true)}</div></div>
            <div className="col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">Date & time</div>
              <div className="mt-1 font-semibold">{d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div></div>
            {txn.note && <div className="col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">Note</div><div className="mt-1 font-medium">{txn.note}</div></div>}
          </div>
          {!anonymous && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted p-4">
            <div className="flex h-9 w-12 items-center justify-center rounded-md bg-sky text-[11px] font-bold text-primary-foreground">perk</div>
            <div className="text-sm"><div className="font-semibold">{holder}</div><div className="text-muted-foreground">IBAN {iban}</div></div>
          </div>
          )}
        </div>
        {/* Barcode stub with scalloped edge */}
        <div className="relative bg-card px-7 pb-10 pt-5" style={{ WebkitMask: SCALLOP, mask: SCALLOP }}>
          <div className="absolute left-4 right-4 top-0 border-t-2 border-dashed border-border" />
          <Barcode value={txn.reference.slice(-12).padStart(12, "0")} />
        </div>
      </div>
    </div>
  );
}
