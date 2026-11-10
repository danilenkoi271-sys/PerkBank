import { motion } from "motion/react";
import { formatMoney, getCategory } from "@/lib/categories";
import type { Txn } from "@/lib/bank";
import { cn } from "@/lib/utils";
import { TxnIcon } from "./TxnIcon";

function day(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function TransactionList({ txns, onSelect, right, flat = false }: { txns: Txn[]; onSelect?: (t: Txn) => void; right?: (t: Txn) => React.ReactNode; flat?: boolean }) {
  if (!txns.length) return <p className="py-10 text-center text-sm text-muted-foreground">No transactions yet.</p>;
  return (
    <div className={cn("overflow-hidden", flat ? "text-foreground" : "text-card-foreground rounded-3xl bg-card shadow-[0_0_0_1px_var(--border)]")}>
      {txns.map((t, i) => {
        const inc = t.amount > 0;
        return (
          <motion.div key={t.id} initial={flat ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: flat ? Math.min(i, 12) * 0.035 + 0.15 : 0 }}
            className={cn("flex items-center gap-3 py-3.5 transition-colors", flat ? "px-2" : "px-4 hover:bg-muted", i > 0 && !flat && "border-t")}>
            <button className="flex min-w-0 flex-1 items-center gap-3.5 text-left" onClick={() => onSelect?.(t)}>
              <TxnIcon icon={t.icon} title={t.title} category={t.category} incoming={inc} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{t.title}</span>
                <span className={cn("block truncate text-xs", flat ? "text-foreground/65" : "text-muted-foreground")}>{t.note || getCategory(t.category).label}</span>
              </span>
              <span className="text-right">
                <span className={cn("block text-[15px] font-medium tabular-nums", inc && "text-success")}>{formatMoney(t.amount, true)}</span>
                {t.created_at && <span className="block font-mono text-[10.5px] text-muted-foreground">{day(t.created_at)}</span>}
              </span>
            </button>
            {right?.(t)}
          </motion.div>
        );
      })}
    </div>
  );
}
