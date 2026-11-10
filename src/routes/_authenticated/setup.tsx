import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, User } from "lucide-react";
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

const field = "w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";

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
    <div className="flex min-h-screen items-center justify-center px-6 py-10 text-foreground">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl bg-card p-8 text-card-foreground shadow-soft">
        <PerkLogo className="text-3xl" />
        <div>
          <h1 className="text-2xl font-bold">Set up your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your personal account starts here.</p>
        </div>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><User className="h-3.5 w-3.5" /> Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className={field} placeholder="Alex Rivera" />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Banking PIN</span>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 5))} type="password" inputMode="numeric" autoComplete="new-password" placeholder="•••••" required pattern="\d{5}" className={`${field} tracking-[0.5em]`} />
          <span className="mt-1 block text-xs text-muted-foreground">Exactly 5 digits. You'll need it every time you open Perk.</span>
        </label>
        <Button disabled={busy || !name.trim() || pin.length !== 5} className="w-full rounded-xl bg-sky py-3 font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Creating your account…" : "Create my account"}
        </Button>
      </form>
    </div>
  );
}
