import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { formatMoney, getCategory } from "@/lib/categories";
import type { Txn } from "@/lib/bank";
import { cn } from "@/lib/utils";
import { TxnIcon } from "./TxnIcon";

const EASE = [0.16, 1, 0.3, 1] as const;

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dayLabel(d: Date) {
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" as const }) });
}
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

type Group = { key: string; label: string; net: number; items: Txn[] };
function group(txns: Txn[]): Group[] {
  const out: Group[] = [];
  for (const t of txns) {
    const d = new Date(t.created_at); const key = dayKey(d);
    let g = out[out.length - 1];
    if (!g || g.key !== key) { g = { key, label: dayLabel(d), net: 0, items: [] }; out.push(g); }
    g.net += t.amount; g.items.push(t);
  }
  return out;
}

export function TransactionList({ txns, onSelect, right, flat = false }: { txns: Txn[]; onSelect?: (t: Txn) => void; right?: (t: Txn) => React.ReactNode; flat?: boolean }) {
  if (!txns.length) return <p className="py-10 text-center text-sm text-muted-foreground">No transactions yet.</p>;
  return flat ? <Grouped txns={txns} onSelect={onSelect} right={right} /> : <Framed txns={txns} onSelect={onSelect} right={right} />;
}

/** Dashboard presentation: grouped by day, one soft card per day. */
function Grouped({ txns, onSelect, right }: { txns: Txn[]; onSelect: ((t: Txn) => void) | undefined; right: ((t: Txn) => React.ReactNode) | undefined }) {
  return (
    <div className="space-y-5 text-foreground">
      {group(txns).map((g, gi) => (
        <motion.section key={g.key} aria-label={g.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -8% 0px" }} transition={{ duration: 0.7, ease: EASE, delay: Math.min(gi, 3) * 0.05 }}>
          <div className="flex items-baseline justify-between px-2 pb-2">
            <h3 className="mono-label !font-normal text-muted-foreground" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>{g.label}</h3>
            <span className={cn("font-mono text-[11px] tabular-nums", g.net > 0 ? "text-success" : "text-muted-foreground")}>{formatMoney(g.net, true)}</span>
          </div>
          <div className="divide-y divide-white overflow-hidden rounded-3xl bg-bone/70">
            {g.items.map(t => {
              const inc = t.amount > 0;
              return (
                <div key={t.id} className="flex items-center">
                  <button type="button" onClick={() => onSelect?.(t)} className="group flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-white">
                    <TxnIcon icon={t.icon} title={t.title} category={t.category} incoming={inc} className="h-11 w-11 transition-transform duration-500 group-hover:scale-105" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium tracking-[-0.01em]">{t.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {getCategory(t.category).label !== t.title && <><span className="truncate">{getCategory(t.category).label}</span><span aria-hidden="true">·</span></>}<span className="font-mono">{time(t.created_at)}</span>
                      </span>
                      {t.note && <span className="mt-1.5 inline-block max-w-full truncate rounded-full bg-white px-2.5 py-0.5 text-[11px] text-ink/65 ring-1 ring-border transition-colors group-hover:bg-bone">{t.note}</span>}
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[15px] font-medium tabular-nums", inc ? "bg-success/10 text-success" : "")}>{formatMoney(t.amount, true)}</span>
                    <ChevronRight aria-hidden="true" className="-ml-1.5 h-4 w-4 shrink-0 -translate-x-1 text-ink/25 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                  </button>
                  {right?.(t)}
                </div>
              );
            })}
          </div>
        </motion.section>
      ))}
    </div>
  );
}

/** Framed presentation kept for other callers (administration). */
function Framed({ txns, onSelect, right }: { txns: Txn[]; onSelect: ((t: Txn) => void) | undefined; right: ((t: Txn) => React.ReactNode) | undefined }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-card text-card-foreground shadow-[0_0_0_1px_var(--border)]">
      {txns.map((t, i) => {
        const inc = t.amount > 0;
        return (
          <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted", i > 0 && "border-t")}>
            <button className="flex min-w-0 flex-1 items-center gap-3.5 text-left" onClick={() => onSelect?.(t)}>
              <TxnIcon icon={t.icon} title={t.title} category={t.category} incoming={inc} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{t.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.note || getCategory(t.category).label}</span>
              </span>
              <span className="text-right">
                <span className={cn("block text-[15px] font-medium tabular-nums", inc && "text-success")}>{formatMoney(t.amount, true)}</span>
                {t.created_at && <span className="block font-mono text-[10.5px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
              </span>
            </button>
            {right?.(t)}
          </div>
        );
      })}
    </div>
  );
}
