import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, User } from "lucide-react";
import { motion } from "motion/react";
import { PerkLogo } from "@/components/perk/PerkCard";
import { getSetupInfo, setupProfile } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Set up your account — Perk" },
      { name: "description", content: "Choose your name and banking PIN to open your Perk account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Set up your account — Perk" },
      { property: "og:description", content: "Choose your name and banking PIN to open your Perk account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});



function SetupPage() {
  const navigate = useNavigate();
  const info = useServerFn(getSetupInfo);
  const setup = useServerFn(setupProfile);
  const { data, isLoading } = useQuery({ queryKey: ["setup-info"], queryFn: () => info() });
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (data && !prefilled) {
      setName(data.suggestedName);
      setPrefilled(true);
    }
  }, [data, prefilled]);

  if (isLoading || !data) return null;
  if (data.hasProfile) return <Navigate to="/account" />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await setup({ data: { full_name: name.trim(), pin } });
      toast.success("Welcome to Perk!");
      void navigate({ to: "/account" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed — please try again");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bone px-5 py-10 text-ink">
      <motion.form onSubmit={submit} className="w-full max-w-[440px]" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
        <PerkLogo className="text-4xl" />
        <span className="mono-label mt-12 block text-muted-foreground">Step 2 of 2</span>
        <h1 className="mt-3 text-[44px] font-medium leading-[0.95]">Set up your <span className="serif-accent">account.</span></h1>
        <p className="mt-3 text-muted-foreground">Your personal account starts here.</p>
        <div className="panel mt-8 space-y-6 p-6">
          <label className="block">
            <span className="field-label flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className="field" placeholder="Alex Rivera" />
          </label>
          <label className="block">
            <span className="field-label flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Banking PIN</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 5))} type="password" inputMode="numeric" autoComplete="new-password" placeholder="•••••" required pattern="\d{5}" className="field font-mono tracking-[0.6em]" />
            <span className="mt-2 block text-xs text-muted-foreground">Exactly 5 digits. You'll need it every time you open Perk.</span>
          </label>
        </div>
        <Button disabled={busy || !name.trim() || pin.length !== 5} className="mt-3 h-14 w-full rounded-full bg-ink text-base font-medium text-bone hover:bg-ink/85 disabled:opacity-35">
          {busy ? "Creating your account…" : "Create my account"}
        </Button>
      </motion.form>
    </div>
  );
}
