import type { ReactNode } from "react";
import { ChartCandlestick, TrendingUp } from "lucide-react";
import { getCategory, CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

/* Simplified brand marks (inline so they always render). */
const BRANDS: Record<string, { label: string; match: RegExp; render: () => ReactNode }> = {
  uber: {
    label: "Uber", match: /\buber\b/i,
    render: () => (
      <span className="flex h-full w-full items-center justify-center rounded-[inherit] bg-[oklch(0_0_0)] font-sans text-[0.62em] font-bold tracking-tight text-[oklch(1_0_0)]">Uber</span>
    ),
  },
  spotify: {
    label: "Spotify", match: /spotify/i,
    render: () => (
      <svg viewBox="0 0 24 24" className="h-full w-full">
        <circle cx="12" cy="12" r="12" fill="oklch(0.72 0.2 150)" />
        <g fill="none" stroke="oklch(0.12 0 0)" strokeLinecap="round">
          <path d="M6.2 9.3c3.8-1.2 8-.9 11.5 1" strokeWidth="1.9" />
          <path d="M6.9 12.6c3.1-.9 6.4-.6 9.3.9" strokeWidth="1.6" />
          <path d="M7.5 15.6c2.4-.6 5-.4 7.1.7" strokeWidth="1.3" />
        </g>
      </svg>
    ),
  },
  netflix: {
    label: "Netflix", match: /netflix/i,
    render: () => (
      <svg viewBox="0 0 24 24" className="h-full w-full">
        <rect width="24" height="24" rx="12" fill="oklch(0.12 0 0)" />
        <path d="M8.5 5h2.4l2.6 7.4V5h2v14h-2.3l-2.7-7.6V19h-2z" fill="oklch(0.58 0.24 27)" />
      </svg>
    ),
  },
};

export const BRAND_OPTIONS = Object.entries(BRANDS).map(([id, b]) => ({ value: `brand:${id}`, label: b.label }));
export const CATEGORY_ICON_OPTIONS = CATEGORIES.map((c) => ({ value: `cat:${c.id}`, label: c.label }));

export function resolveBrand(icon: string | null | undefined) {
  return icon?.startsWith("brand:") ? BRANDS[icon.slice(6)] ?? null : null;
}

/** One quiet tile style for every transaction: a clean line icon, tinted green for money in and neutral for money out. */
function tileClass(incoming: boolean | undefined, dark: boolean) {
  if (incoming) return dark ? "bg-[#3ddc84]/10 text-[#4be08f] ring-[#3ddc84]/15" : "bg-success/10 text-success ring-success/15";
  return dark ? "bg-white/[0.06] text-bone/85 ring-white/10" : "bg-bone text-ink ring-ink/[0.06]";
}

export function TxnIcon({ icon, title, category, incoming, className, dark = false }: {
  icon?: string | null; title: string; category: string; incoming?: boolean; className?: string; dark?: boolean;
}) {
  const base = cn("flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full", className);
  if (icon && (icon.startsWith("data:image/") || icon.startsWith("https://"))) {
    return <span className={base}><img src={icon} alt="" className="h-full w-full object-cover" /></span>;
  }
  const brand = resolveBrand(icon);
  if (brand) return <span className={base}>{brand.render()}</span>;
  const id = icon?.startsWith("cat:") ? icon.slice(4) : category;
  // Trading gets its own glyphs; everything else uses its category icon.
  const Icon = id === "investment" ? ChartCandlestick : id === "investment_payout" ? TrendingUp : getCategory(id).icon;
  return (
    <span aria-label={title} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset", tileClass(incoming, dark), className)}>
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}
