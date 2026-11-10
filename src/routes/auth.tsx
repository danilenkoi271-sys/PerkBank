import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PerkLogo } from "@/components/perk/PerkCard";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Perk" },
      { name: "description", content: "Sign in to Perk with Google to open your account, investing and perks." },
      { property: "og:title", content: "Sign in — Perk" },
      { property: "og:description", content: "Sign in to Perk with Google to open your account, investing and perks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/account", replace: true });
    });
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` });
    if (result.error) {
      setError("Google sign-in didn't work. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return; // browser is heading to Google
    setBusy(false);
    void navigate({ to: "/account" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center text-foreground">
      <Link to="/" aria-label="Perk home"><PerkLogo className="text-4xl" /></Link>
      <h1 className="mt-8 text-4xl font-bold sm:text-5xl">One account. Endless perks.</h1>
      <p className="mt-3 max-w-sm text-foreground/75">Sign in to open your Perk account and rewards.</p>
      <button
        onClick={signIn}
        disabled={busy}
        className="mt-10 inline-flex items-center gap-2.5 rounded-full border border-[#8E918F] bg-[#131314] py-3 pl-3 pr-3 text-sm font-medium text-[#E3E3E3] transition hover:scale-[1.03] disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <p className="mt-6 text-xs text-foreground/60">Google sign-in only — no passwords to remember.</p>
    </div>
  );
}
