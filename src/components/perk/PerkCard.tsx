import { useRef, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PerkLogo({ className }: { className?: string }) {
  return (
    <span className={cn("font-logo font-semibold leading-none", className)}>
      perk<sup className="ml-[0.04em] text-[0.6em] font-bold align-[0.55em]">+</sup>
    </span>
  );
}

type Props = { last4?: string | undefined; holder?: string | undefined; number?: string | undefined; expiry?: string | undefined; className?: string; tilt?: boolean; onClick?: () => void; onToggleDetails?: () => void; revealed?: boolean };

export function PerkCard({ last4, holder, number, expiry, className, tilt = true, onClick, onToggleDetails, revealed }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: MouseEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg) translateZ(10px)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };

  return (
    <div className={cn("[perspective:1200px]", className)}>
      <div
        ref={ref}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? "Open Perk account" : "Perk card"}
        onClick={onClick}
        onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) onClick(); }}
        onMouseMove={move}
        onMouseLeave={leave}
        className={cn(
          "perk-card relative w-full overflow-hidden transition-transform duration-300 ease-out select-none",
          onClick && "cursor-pointer active:scale-[0.98]",
        )}
      >
        <div className="card-sheen pointer-events-none absolute inset-0" />
        <div className="absolute inset-0 flex flex-col justify-between p-[6.5cqw]">
          <PerkLogo className="text-[11cqw]" />
          <div className="font-sans font-semibold">
            {number ? (
              <div className="text-[6cqw] tracking-[0.12em] tabular-nums animate-in fade-in duration-500">{number}</div>
            ) : (
              <div className="text-[4.4cqw] tracking-wider"><span className="mr-[1.5cqw] tracking-[0.1em]">••</span>{last4 ?? "••••"}</div>
            )}
            <div className="mt-[1.5cqw] flex items-end justify-between text-[3.2cqw] font-medium uppercase tracking-wider opacity-80">
              <span>{holder ?? "Perk member"}</span>
              {expiry && <span className={cn("animate-in fade-in duration-500", onToggleDetails && "mr-10")}>{expiry}</span>}
            </div>
          </div>
        </div>
        {onToggleDetails && <Button variant="ghost" size="icon" onClick={onToggleDetails} aria-label={revealed ? "Hide card details" : "Show card details"} title={revealed ? "Hide card details" : "Show card details"} aria-pressed={revealed} className="absolute bottom-[6%] right-[5%] h-8 w-8 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/25">{revealed ? <EyeOff /> : <Eye />}</Button>}
      </div>
    </div>
  );
}
