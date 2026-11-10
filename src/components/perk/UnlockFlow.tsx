import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Delete } from "lucide-react";
import { motion } from "motion/react";
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
    <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bone px-6 text-ink" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <motion.div className="flex flex-col items-center" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}>
        <PerkLogo className="text-4xl" />
        <p className="mt-8 text-lg font-medium tracking-[-0.02em]">Enter your Perk PIN</p>
        <div className={cn("mt-6 flex gap-3.5", bad && "animate-shake")}>
          {Array.from({ length: LEN }).map((_, i) => (
            <motion.span key={i} animate={{ scale: i < code.length ? 1 : 0.7 }} transition={{ type: "spring", stiffness: 600, damping: 22 }} className={cn("h-3.5 w-3.5 rounded-full transition-colors duration-200", i < code.length ? (bad ? "bg-destructive" : "bg-ink") : "bg-ink/15")} />
          ))}
        </div>
        <p className="mt-3 h-5 text-sm text-destructive">{bad ? "Wrong PIN" : ""}</p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Key key={d} d={d} onPress={press} />)}
          <button onClick={onClose} className="text-sm font-medium text-muted-foreground transition hover:text-ink">Cancel</button>
          <Key d="0" onPress={press} />
          <button aria-label="Delete" onClick={() => setCode((c) => c.slice(0, -1))} className="flex items-center justify-center text-ink/70 transition hover:text-ink"><Delete className="h-6 w-6" /></button>
        </div>
        <button onClick={() => { void supabase.auth.signOut(); }} className="mt-10 text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-ink hover:underline">
          Not you? Sign out
        </button>
      </motion.div>
    </motion.div>
  );
}

function Key({ d, onPress }: { d: string; onPress: (d: string) => void }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={() => onPress(d)} className="h-[76px] w-[76px] rounded-full bg-white text-[28px] font-normal tracking-[-0.02em] shadow-[0_0_0_1px_var(--border)] transition-colors hover:bg-white/60 active:bg-ink active:text-bone">
      {d}
    </motion.button>
  );
}
