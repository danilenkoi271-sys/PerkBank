import { formatMoney, getCategory } from "@/lib/categories";
import type { Txn } from "@/lib/bank";
import { cn } from "@/lib/utils";
import { TxnIcon } from "./TxnIcon";

export function TransactionList({ txns, onSelect, right, flat = false }: { txns: Txn[]; onSelect?: (t: Txn) => void; right?: (t: Txn) => React.ReactNode; flat?: boolean }) {
  if (!txns.length) return <p className="py-10 text-center text-sm text-foreground/75">No transactions yet.</p>;
  return (
    <div className={cn("overflow-hidden", flat ? "text-foreground" : "text-card-foreground rounded-3xl bg-card shadow-soft")}>
      {txns.map((t, i) => {
        const inc = t.amount > 0;
        return (
          <div key={t.id} className={cn("flex items-center gap-3 py-4 transition-colors", flat ? "px-1 hover:bg-foreground/5" : "px-4 hover:bg-muted", i > 0 && (flat ? "border-t border-foreground/10" : "border-t"))}>
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onSelect?.(t)}>
              <TxnIcon icon={t.icon} title={t.title} category={t.category} incoming={inc} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.title}</span>
                <span className={cn("block truncate text-xs", flat ? "text-foreground/65" : "text-muted-foreground")}>{t.note || getCategory(t.category).label}</span>
              </span>
              <span className={cn("font-display font-semibold tabular-nums", inc && "text-success")}>{formatMoney(t.amount, true)}</span>
            </button>
            {right?.(t)}
          </div>
        );
      })}
    </div>
  );
}
