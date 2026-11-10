import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Gift, Zap, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PerkLogo } from '@/components/perk/PerkCard';
import video from '@/assets/perk_card_hoop.mp4.asset.json';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Perk — the bank with perks' }, { name: 'description', content: 'One account, endless perks. Surprise bonuses and rewards other banks keep for themselves.' }, { property: 'og:title', content: 'Perk — the bank with perks' }, { property: 'og:description', content: 'One account, endless perks. Surprise bonuses and rewards other banks keep for themselves.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Landing,
});
function Landing() {
  const navigate = useNavigate(); const start = () => void navigate({ to: '/account' });
  return <div className="overflow-x-hidden text-foreground">
    <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6"><PerkLogo className="text-3xl"/><Button onClick={start} className="rounded-full bg-lime px-5 text-ink hover:bg-lime/90">Open account<ArrowRight className="h-4 w-4"/></Button></nav>
    <section className="video-hero relative -mt-20 flex flex-col items-center">
      <div className="landing-video relative aspect-[852/1080] h-[46vh] min-h-[300px] max-h-[820px] max-w-full sm:h-[78vh] sm:min-h-[420px]">
        <video aria-label="Perk basketball video" ref={el => { if (el) { el.muted = true; try { void el.play()?.catch(() => {}); } catch { /* unsupported playback */ } } }} src={video.url} autoPlay muted loop playsInline preload="auto" className="h-full w-full object-contain"/>
      </div>
      <div className="landing-hero-text relative -mt-16 px-6 text-center sm:-mt-24"><span className="animate-rise inline-flex items-center gap-2 rounded-full bg-foreground/15 px-3 py-1.5 text-xs font-semibold backdrop-blur"><Sparkles className="h-3.5 w-3.5"/>The bank with perks</span>
        <h1 className="animate-rise mt-4 text-5xl font-bold leading-[0.95] sm:mt-5 sm:text-8xl">Banking, but<br/>make it perks.</h1><p className="animate-rise mx-auto mt-4 max-w-lg text-base text-foreground/80 sm:mt-5 sm:text-lg">One account. Endless perks. Surprise bonuses and rewards other banks keep for themselves.</p>
        <Button onClick={start} className="animate-rise mt-6 h-14 rounded-full bg-lime px-7 text-base text-ink hover:bg-lime/90 sm:mt-8">Unlock perks<ArrowRight className="h-4 w-4"/></Button>
      </div>
    </section>
    <div className="landing-marquee mt-24 border-y border-foreground/15 bg-ink/40 py-5 backdrop-blur"><div className="animate-marquee flex w-max gap-12 whitespace-nowrap font-display text-2xl font-semibold">{Array.from({ length: 2 }).flatMap((_, k) => ['Perks on everything', '✦', 'Surprise bonuses', '✦', 'Instant transfers', '✦', 'Instant history', '✦', '2% cashback', '✦'].map((w, i) => <span key={`${k}-${i}`}>{w}</span>))}</div></div>
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2"><div><h2 className="text-5xl font-bold leading-tight">An account that<br/>feels like a win.</h2><p className="mt-4 max-w-md text-foreground/80">A little more from your everyday — perks, bonuses and surprises included.</p></div><div className="grid gap-4 sm:grid-cols-2">{[
      { i: Gift, t: 'Perks & Rewards', d: 'Unlock exclusive rewards, bonuses and special benefits.' }, { i: TrendingUp, t: 'Your next move', d: 'Invest on your terms, with a target you choose.' }, { i: Zap, t: 'Instant History', d: 'Every payment appears as it happens.' }, { i: ShieldCheck, t: 'Receipts for Days', d: 'Every transaction comes with its own detailed receipt.' },
    ].map(({ i: Icon, t, d }) => <div key={t} className="rounded-3xl bg-card p-6 text-card-foreground shadow-soft transition hover:-translate-y-1"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky"><Icon className="h-5 w-5 text-primary-foreground"/></span><h3 className="mt-4 text-lg font-bold">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>)}</div></section>
    <section className="landing-account-cta bg-ink px-6 py-16 text-center text-ink-foreground"><h2 className="text-5xl font-bold sm:text-6xl">Your account is waiting.</h2><Button onClick={start} className="mt-8 h-14 rounded-full bg-lime px-8 text-base text-ink hover:bg-lime/90">Unlock Perk<ArrowRight className="h-5 w-5"/></Button></section>
    <footer className="mx-auto max-w-6xl px-6 py-8 text-sm text-foreground/75"><div className="flex items-center justify-between"><PerkLogo className="text-xl"/><span>© {new Date().getFullYear()} Perk.</span></div><p className="mt-6 max-w-4xl text-xs leading-relaxed text-foreground/60">Terms: This is a personal test site built for fun, not a real bank, broker or financial service. No real money is held, moved or invested. All balances, trades, profits and transactions are fictional. Trading is simulated and outcomes are chosen by the administrator; there is no live trading or promised return. Five-digit “IBANs” are internal identifiers, not valid international bank account numbers. We do not own, represent or have any affiliation with any company, brand or product named “Perk” (or similar), or any other company whose name or logo appears here. All trademarks belong to their respective owners. Nothing on this site is financial advice or an offer of any financial service.</p></footer>
  </div>;
}