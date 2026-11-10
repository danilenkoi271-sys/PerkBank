import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PerkLogo } from "@/components/perk/PerkCard";
import { motion } from "motion/react";

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
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
    <div className="grid min-h-dvh bg-bone text-ink lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link to="/" aria-label="Perk home" className="self-start"><PerkLogo className="text-[30px]" /></Link>
        <motion.div className="my-auto w-full max-w-[420px] py-16" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
          <span className="mono-label text-muted-foreground">Welcome to Perk</span>
          <h1 className="mt-4 text-[clamp(44px,6vw,64px)] font-medium leading-[0.95]">One account.<br /><span className="serif-accent">Endless perks.</span></h1>
          <p className="mt-5 max-w-sm text-muted-foreground">Sign in to open your Perk account and rewards.</p>
          <button
            onClick={signIn}
            disabled={busy}
            className="mt-10 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink px-6 text-[15px] font-medium text-bone transition hover:bg-ink/85 active:scale-[0.98] disabled:opacity-60"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white"><GoogleMark /></span>
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <p className="mt-5 text-xs text-muted-foreground">Google sign-in only — no passwords to remember.</p>
        </motion.div>
      </div>
      <motion.div className="relative m-3 hidden overflow-hidden rounded-[32px] court-bg lg:block" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
        <video aria-label="Perk card and basketball hoop" ref={el => { if (el) { el.muted = true; try { void el.play()?.catch(() => {}); } catch { /* playback unsupported */ } } }} src="/media/perk-hoop.mp4" poster="/media/perk-hoop-poster.jpg" autoPlay muted loop playsInline className="cta-video absolute left-1/2 top-1/2 h-[92%] -translate-x-1/2 -translate-y-1/2 object-cover" />
        <p className="absolute bottom-8 left-8 right-8 text-[15px] text-white/80">The bank with perks, built for everyone.</p>
      </motion.div>
    </div>
  );
}
