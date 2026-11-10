import type { ReactNode } from "react";
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

export function resolveBrand(icon: string | null | undefined, title: string) {
  if (icon?.startsWith("brand:")) return BRANDS[icon.slice(6)] ?? null;
  if (icon) return null;
  return Object.values(BRANDS).find((b) => b.match.test(title)) ?? null;
}

/** Trading stakes and payouts get their own marks, drawn in the same thin-line style as the live chart. */
function TradeMark({ kind }: { kind: "stake" | "payout" }) {
  const payout = kind === "payout";
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`tm-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={payout ? "#37d886" : "#2b3d6e"} />
          <stop offset="1" stopColor={payout ? "#12794a" : "#0d111d"} />
        </linearGradient>
        <radialGradient id={`tg-${kind}`} cx="0.3" cy="0.2" r="0.9"><stop offset="0" stopColor="#fff" stopOpacity="0.28" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="44" height="44" fill={`url(#tm-${kind})`} />
      <rect width="44" height="44" fill={`url(#tg-${kind})`} />
      {payout ? (
        <>
          <polyline points="9,29 16,23 21,26 28,16 34,12" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="34" cy="12" r="2.6" fill="#fff" />
          <circle cx="34" cy="12" r="5" fill="#fff" opacity="0.22" />
        </>
      ) : (
        <>
          <polyline points="9,25 15,20 20,26 26,17 30,22 35,15" fill="none" stroke="#7aa2ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="35" cy="15" r="2.4" fill="#cfe0ff" />
          <line x1="9" y1="32" x2="35" y2="32" stroke="#7aa2ff" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" />
        </>
      )}
    </svg>
  );
}

export function TxnIcon({ icon, title, category, incoming, className, dark = false }: {
  icon?: string | null; title: string; category: string; incoming?: boolean; className?: string; dark?: boolean;
}) {
  const base = cn("flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full", className);
  if (icon && (icon.startsWith("data:image/") || icon.startsWith("https://"))) {
    return <span className={base}><img src={icon} alt="" className="h-full w-full object-cover" /></span>;
  }
  const brand = resolveBrand(icon, title);
  if (brand) return <span className={base}>{brand.render()}</span>;
  const id = icon?.startsWith("cat:") ? icon.slice(4) : category;
  if (id === "investment" || id === "investment_payout") return <span className={base}><TradeMark kind={id === "investment" ? "stake" : "payout"} /></span>;
  const cat = getCategory(id);
  const Icon = cat.icon;
  return (
    <span className={cn(base, incoming ? "bg-sky text-primary-foreground" : dark ? "bg-white/10 text-bone" : "bg-muted text-card-foreground")}>
      <Icon className="h-[45%] w-[45%]" />
    </span>
  );
}
