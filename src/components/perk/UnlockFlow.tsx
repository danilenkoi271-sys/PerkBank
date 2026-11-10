import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Delete } from "lucide-react";
import { PerkLogo } from "./PerkCard";
import { unlockAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const LEN = 5;

/** Personal banking PIN (checked on the server). */
export function UnlockFlow({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked: () => void }) {
  if (!open) return null;
  return <Passcode onClose={onClose} onUnlocked={onUnlocked} />;
}

function Passcode({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: () => void }) {
  const unlock = useServerFn(unlockAccount);
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (code.length !== LEN) return;
    setBusy(true);
    unlock({ data: { pin: code } })
      .then(({ ok }) => {
        setBusy(false);
        if (ok) onUnlocked();
        else { setBad(true); setTimeout(() => { setBad(false); setCode(""); }, 550); }
      })
      .catch(() => {
        setBusy(false);
        setBad(true); setTimeout(() => { setBad(false); setCode(""); }, 550);
      });
  }, [code, unlock, onUnlocked]);

  const press = (d: string) => { if (!busy && code.length < LEN) setCode((c) => c + d); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/55 px-6 text-foreground backdrop-blur-2xl animate-in fade-in duration-300">
      <PerkLogo className="mb-6 text-3xl" />
      <p className="text-lg font-semibold">Enter your Perk PIN</p>
      <div className={cn("mt-6 flex gap-4", bad && "animate-shake")}>
        {Array.from({ length: LEN }).map((_, i) => (
          <span key={i} className={cn("h-3.5 w-3.5 rounded-full border-2 border-foreground transition-colors", i < code.length && "bg-foreground")} />
        ))}
      </div>
      <p className="mt-3 h-5 text-sm text-foreground/80">{bad ? "Wrong PIN" : ""}</p>
      <div className="mt-6 grid grid-cols-3 gap-5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Key key={d} d={d} onPress={press} />)}
        <button onClick={onClose} className="text-sm font-medium">Cancel</button>
        <Key d="0" onPress={press} />
        <button aria-label="Delete" onClick={() => setCode((c) => c.slice(0, -1))} className="flex items-center justify-center"><Delete className="h-6 w-6" /></button>
      </div>
      <button onClick={() => { void supabase.auth.signOut(); }} className="mt-10 text-sm font-medium text-foreground/70 underline underline-offset-4">
        Not you? Sign out
      </button>
    </div>
  );
}

function Key({ d, onPress }: { d: string; onPress: (d: string) => void }) {
  return (
    <button onClick={() => onPress(d)} className="h-[72px] w-[72px] rounded-full bg-foreground/15 font-display text-3xl font-medium transition active:bg-foreground/40">
      {d}
    </button>
  );
}
