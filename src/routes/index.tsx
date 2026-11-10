import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform, cubicBezier, type MotionValue } from 'motion/react';
import { ArrowRight, ArrowUpRight, Check, Fingerprint } from 'lucide-react';
import { PerkLogo } from '@/components/perk/PerkCard';
import { CountUp, EASE, MaskWords, Reveal, ScrollWords } from '@/components/perk/motion';

const VIDEO = '/media/perk-hoop.mp4';
const POSTER = '/media/perk-hoop-poster.jpg';
const DESCRIPTION = 'One account. Endless perks. Send money in seconds, invest on your terms and unlock rewards other banks keep for themselves.';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Perk — the bank with perks' }, { name: 'description', content: DESCRIPTION }, { property: 'og:title', content: 'Perk — the bank with perks' }, { property: 'og:description', content: DESCRIPTION }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }], links: [{ rel: 'preload', href: POSTER, as: 'image' }] }),
  component: Landing,
});

function Landing() {
  return <div className="landing">
    <Nav/>
    <Hero/>
    <Marquee/>
    <Statement/>
    <Features/>
    <Steps/>
    <FinalCta/>
    <Footer/>
  </div>;
}

/* ───────── Shared bits ───────── */

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(m.matches);
    update(); m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);
  return mobile;
}

/** Muted, looping, inline video that only plays while it's on screen (iOS needs muted set on the element). */
function HoopVideo({ className, style, label = 'Perk card and basketball hoop' }: { className?: string; style?: React.ComponentProps<typeof motion.video>['style']; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const visible = useInView(ref, { margin: '20% 0px' });
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.muted = true;
    if (visible) { try { void v.play()?.catch(() => {}); } catch { /* playback unsupported */ } }
    else v.pause();
  }, [visible]);
  return <motion.video ref={ref} aria-label={label} src={VIDEO} poster={POSTER} autoPlay muted loop playsInline preload="auto" className={className} style={style ?? {}}/>;
}

function CtaLink({ children, tone = 'ink', size, className = '' }: { children: React.ReactNode; tone?: 'ink' | 'bone' | 'ghost'; size?: 'lg'; className?: string }) {
  return <Link to="/account" className={`pill-btn pill-${tone} ${size === 'lg' ? 'pill-lg' : ''} ${className}`}>{children}</Link>;
}

/* ───────── Navigation ───────── */

function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > 24));
  return <motion.nav className="landing-nav" data-scrolled={scrolled} initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, ease: EASE, delay: 0.2 }}>
    <div className="landing-nav-inner">
      <Link to="/" aria-label="Perk home"><PerkLogo className="text-[28px]"/></Link>
      <div className="flex items-center gap-1">
        <CtaLink tone="ghost" className="hidden sm:inline-flex">Sign in</CtaLink>
        <CtaLink>Open account<ArrowRight/></CtaLink>
      </div>
    </div>
  </motion.nav>;
}

/* ───────── Hero: the video window opens up to fill the screen ───────── */

const openEase = cubicBezier(0.65, 0, 0.35, 1);

function Hero() {
  const track = useRef<HTMLDivElement>(null);
  const mobile = useIsMobile();
  const { scrollYProgress: p } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const open = useTransform(p, [0, 0.52], [0, 1], { ease: openEase });

  const clipPath = useTransform(open, v => {
    const r = 1 - v;
    return mobile
      ? `inset(${22 * r}% ${13 * r}% ${34 * r}% ${13 * r}% round ${28 * r}px)`
      : `inset(${15 * r}% calc((50% - min(19vw, 27vh)) * ${r}) ${15 * r}% calc((50% - min(19vw, 27vh)) * ${r}) round ${36 * r}px)`;
  });
  // Zoomed out so the whole card shows in the window, pushes in as it opens, then eases back to make room for the copy.
  const videoScale = useTransform(p, [0, 0.52, 0.74], mobile ? [0.52, 0.7, 0.64] : [0.74, 1.04, 0.84], { ease: openEase });
  const videoY = useTransform(p, [0.52, 0.74], ['0svh', mobile ? '-12svh' : '-13svh'], { ease: openEase });
  const leftX = useTransform(open, [0, 1], ['0vw', mobile ? '0vw' : '-34vw']);
  const rightX = useTransform(open, [0, 1], ['0vw', mobile ? '0vw' : '34vw']);
  const leftY = useTransform(open, [0, 1], ['0svh', mobile ? '-16svh' : '0svh']);
  const rightY = useTransform(open, [0, 1], ['0svh', mobile ? '16svh' : '0svh']);
  const wordsOpacity = useTransform(open, [0, 0.55], [1, 0]);
  const footOpacity = useTransform(p, [0, 0.08], [1, 0]);
  const overlayOpacity = useTransform(p, [0.5, 0.64], [0, 1]);
  const overlayY = useTransform(p, [0.5, 0.7], [48, 0]);
  const dim = useTransform(p, [0.82, 1], [0, 0.35]);

  return <section ref={track} className="hero-track" aria-label="Perk — the bank with perks">
    <div className="hero-stage">
      <motion.div className="hero-court" style={{ clipPath }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: EASE }}>
        <HoopVideo className="hero-video" style={{ scale: videoScale, y: videoY }}/>
        <motion.div aria-hidden="true" className="absolute inset-0 bg-ink" style={{ opacity: dim }}/>
      </motion.div>

      <h1 className="sr-only">Banking, with perks.</h1>
      <motion.div aria-hidden="true" className="hero-word hero-word-left" style={{ x: leftX, y: leftY, opacity: wordsOpacity }}>
        <MaskWords text="Banking," inView={false} delay={0.35}/>
      </motion.div>
      <motion.div aria-hidden="true" className="hero-word hero-word-right" style={{ x: rightX, y: rightY, opacity: wordsOpacity }}>
        <span className="serif-accent tracking-[-0.03em]"><MaskWords text="with perks." inView={false} delay={0.5}/></span>
      </motion.div>

      <motion.div className="hero-foot" style={{ opacity: footOpacity }}>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.8 }} className="max-w-[300px] text-[15px] leading-snug text-ink/70">
          One account. Endless perks. Surprise bonuses and rewards other banks keep for themselves.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="flex items-center gap-3 text-ink/60">
          <span className="mono-label hidden sm:inline">Scroll</span><span className="scroll-cue"/>
        </motion.div>
      </motion.div>

      <motion.div className="hero-overlay" style={{ opacity: overlayOpacity, y: overlayY }}>
        <span className="mono-label text-white/85">The bank with perks</span>
        <p className="mt-4 text-[clamp(40px,5.4vw,80px)] font-medium leading-[0.95] tracking-[-0.05em]">One account.<br/><span className="serif-accent">Endless perks.</span></p>
        <CtaLink tone="bone" size="lg" className="mt-8">Open your account<ArrowRight/></CtaLink>
      </motion.div>
    </div>
  </section>;
}

/* ───────── Marquee ───────── */

function Marquee() {
  const words = ['Perks on everything', 'Surprise bonuses', 'Instant transfers', 'Instant history', '2% cashback', 'Receipts for days'];
  return <div className="marquee-band" aria-label="Perk highlights">
    <div className="marquee-row animate-marquee">{[0, 1].flatMap(k => words.flatMap((w, i) => [<span key={`${k}-${i}`}>{w}</span>, <span key={`${k}-${i}+`} aria-hidden="true" className="plus">+</span>]))}</div>
  </div>;
}

/* ───────── Statement ───────── */

function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] });
  return <section className="section py-32 sm:py-44">
    <Reveal><span className="mono-label text-muted-foreground">Why Perk</span></Reveal>
    <div ref={ref} className="mt-8 max-w-[1040px]">
      <ScrollWords progress={scrollYProgress} className="statement" text="Most banks keep the good stuff for themselves. Perk was built for *everyone* — so every payment, every transfer and every win comes back to you as a *perk.*"/>
    </div>
  </section>;
}

/* ───────── Features bento ───────── */

function Features() {
  return <section className="section pb-32 sm:pb-44" id="features">
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
      <h2 className="max-w-[640px] text-[clamp(40px,5vw,72px)] font-medium leading-[0.95]"><MaskWords text="Everything your money needs."/> <span className="serif-accent text-muted-foreground"><MaskWords text="Nothing it doesn't." delay={0.2}/></span></h2>
      <Reveal delay={0.2}><p className="max-w-[300px] text-[15px] leading-relaxed text-muted-foreground">A little more from your everyday — perks, bonuses and surprises included.</p></Reveal>
    </div>
    <div className="bento">
      <Reveal className="tile tile-ink span-4"><BalanceVisual/><TileText title="Your balance, front and centre." body="Open Perk and your money is the first thing you see. Every payment appears the moment it happens."/></Reveal>
      <Reveal className="tile tile-court span-2" delay={0.08}><SendVisual/><TileText title="Send in seconds." body="All it takes is a five-digit Perk IBAN."/></Reveal>
      <Reveal className="tile span-2"><InvestVisual/><TileText title="Your next move." body="Pick a target from 1.1× to 3×, set your stake and confirm with Face ID."/></Reveal>
      <Reveal className="tile span-2" delay={0.08}><ReceiptVisual/><TileText title="Receipts for days." body="Every transaction comes with its own detailed receipt."/></Reveal>
      <Reveal className="tile tile-ink span-2" delay={0.16}><LeagueVisual/><TileText title="The Perk League." body="See how your moves stack up against everyone on Perk."/></Reveal>
      <Reveal className="tile span-6 !min-h-0 sm:!flex-row sm:items-end sm:gap-10"><TileText title="Perks & rewards." body="Unlock exclusive rewards, bonuses and special benefits — the kind other banks keep for themselves."/><PerksVisual/></Reveal>
    </div>
  </section>;
}

function TileText({ title, body }: { title: string; body: string }) {
  return <div className="relative z-10 mt-8 shrink-0"><h3>{title}</h3><p>{body}</p></div>;
}

function BalanceVisual() {
  const rows = [{ t: 'Perk bonus', s: 'Surprise drop', a: '+$25.00', up: true }, { t: 'Salary', s: 'Deposit', a: '+$2,400.00', up: true }, { t: 'Corner Coffee', s: 'Food & Drink', a: '−$4.20', up: false }];
  return <div className="grid gap-8 sm:grid-cols-[1fr_1.1fr] sm:items-start">
    <div>
      <span className="mono-label text-bone/50">Total balance</span>
      <p className="balance-figure mt-3 text-[clamp(44px,5vw,68px)]"><CountUp value={12480.5} split/></p>
      <div className="mt-5 flex gap-2"><span className="rounded-full bg-court px-3 py-1.5 text-xs font-medium text-white">Send</span><span className="rounded-full bg-bone px-3 py-1.5 text-xs font-medium text-ink">Invest</span></div>
    </div>
    <ul className="space-y-1.5">{rows.map((r, i) => <motion.li key={r.t} initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.4 + i * 0.12 }} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${r.up ? 'bg-court text-white' : 'bg-white/10'}`}>{r.t[0]}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.t}</span><span className="block text-[11px] text-bone/45">{r.s}</span></span>
      <span className={`font-mono text-[13px] ${r.up ? 'text-[#7fe0a9]' : 'text-bone/80'}`}>{r.a}</span>
    </motion.li>)}</ul>
  </div>;
}

function SendVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-15% 0px' });
  const digits = ['4', '8', '2', '1', '7'];
  return <div ref={ref}>
    <span className="mono-label text-white/60">Recipient IBAN</span>
    <div className="mt-3 flex gap-1.5">{digits.map((d, i) => <span key={i} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-white/12 font-mono text-xl">
      <motion.span initial={{ opacity: 0, y: 8 }} animate={seen ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.16 }}>{d}</motion.span>
    </span>)}</div>
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={seen ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.6, ease: EASE, delay: 1.25 }} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink">
      <Check className="h-3.5 w-3.5 text-success"/>Sending to Alex R.
    </motion.div>
  </div>;
}

function InvestVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-15% 0px' });
  const [m, setM] = useState(1.1);
  useEffect(() => {
    if (!seen) return;
    let v = 1.1; const id = window.setInterval(() => { v = Math.round((v + 0.1) * 10) / 10; setM(v); if (v >= 2.4) window.clearInterval(id); }, 70);
    return () => window.clearInterval(id);
  }, [seen]);
  const pct = ((m - 1.1) / 1.9) * 100;
  return <div ref={ref}>
    <div className="flex items-start justify-between"><p className="text-[64px] font-medium leading-none tracking-[-0.06em] tabular">{m.toFixed(1)}<span className="text-court">×</span></p><span className="flex h-10 w-10 items-center justify-center rounded-full bg-bone"><Fingerprint className="h-5 w-5"/></span></div>
    <div className="relative mt-6 h-1 rounded-full bg-secondary"><div className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-100" style={{ width: `${pct}%` }}/><div className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(11_12_14/.08),0_6px_16px_-6px_rgb(11_12_14/.4)] transition-[left] duration-100" style={{ left: `${pct}%` }}/></div>
  </div>;
}

function ReceiptVisual() {
  const bars = [2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 2, 1, 3];
  return <div className="relative h-[150px]">
    <motion.div initial={{ y: 40, rotate: -2 }} whileInView={{ y: 0, rotate: -4 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE, delay: 0.2 }} className="absolute left-1/2 top-0 w-[200px] -translate-x-1/2 rounded-[18px] bg-bone p-4 shadow-[0_24px_40px_-24px_rgb(11_12_14/.4)]">
      <div className="flex items-center justify-between"><PerkLogo className="text-base text-court"/><span className="font-mono text-[10px] text-muted-foreground">#PK-48217</span></div>
      <p className="mt-3 text-lg font-medium tracking-[-0.03em]">Money in!</p>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>Perk bonus</span><span className="font-mono text-success">+$25.00</span></div>
      <div className="my-3 border-t border-dashed border-ink/15"/>
      <svg viewBox={`0 0 ${bars.reduce((a, b) => a + b * 2, 0)} 20`} preserveAspectRatio="none" className="h-6 w-full">{(() => { let x = 0; return bars.map((w, i) => { const r = <rect key={i} x={x} width={w} height="20" fill="currentColor"/>; x += w * 2; return r; }); })()}</svg>
    </motion.div>
  </div>;
}

function LeagueVisual() {
  const cols = [{ n: 'M', h: 70, r: '2nd' }, { n: 'J', h: 100, r: '1st' }, { n: 'S', h: 52, r: '3rd' }];
  return <div className="flex h-[150px] items-end gap-2">{cols.map((c, i) => <div key={c.r} className="flex flex-1 flex-col items-center gap-2">
    <motion.span initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 + i * 0.1, duration: 0.6, ease: EASE }} className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${i === 1 ? 'bg-hoop text-white' : 'bg-white/12'}`}>{c.n}</motion.span>
    <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE, delay: 0.2 + i * 0.1 }} style={{ height: `${c.h}px` }} className={`w-full origin-bottom rounded-t-xl rounded-b-md ${i === 1 ? 'bg-bone text-ink' : 'bg-white/10'} flex items-start justify-center pt-2 font-mono text-[11px]`}>{c.r}</motion.div>
  </div>)}</div>;
}

function PerksVisual() {
  const chips = ['+$25 surprise bonus', '2% cashback', 'Perk drop unlocked', 'Double rewards weekend', '+$10 welcome perk'];
  return <div className="relative mt-8 flex flex-1 flex-wrap gap-2 sm:mt-0 sm:justify-end">{chips.map((c, i) => <motion.span key={c} initial={{ opacity: 0, y: 20, scale: 0.9 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE, delay: 0.15 + i * 0.08 }} whileHover={{ y: -3 }} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium ${i === 0 ? 'bg-court text-white' : i === 2 ? 'bg-ink text-bone' : 'bg-bone'}`}><span className={`font-logo ${i === 0 || i === 2 ? '' : 'text-court'}`}>+</span>{c}</motion.span>)}</div>;
}

/* ───────── Steps ───────── */

function Steps() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.6'] });
  const steps = [
    { n: '01', t: 'Continue with Google', d: 'No forms, no passwords to remember.' },
    { n: '02', t: 'Choose your name and PIN', d: 'A five-digit PIN keeps your account yours.' },
    { n: '03', t: 'Get your Perk IBAN', d: 'Start sending, investing and unlocking perks.' },
  ];
  return <section className="section pb-32 sm:pb-44">
    <h2 className="max-w-[720px] text-[clamp(40px,5vw,72px)] font-medium leading-[0.95]"><MaskWords text="Open an account"/> <span className="serif-accent"><MaskWords text="in under a minute." delay={0.15}/></span></h2>
    <div ref={ref} className="mt-16 grid gap-10 md:grid-cols-3 md:gap-6">{steps.map((s, i) => <Step key={s.n} {...s} i={i} progress={scrollYProgress}/>)}</div>
  </section>;
}
function Step({ n, t, d, i, progress }: { n: string; t: string; d: string; i: number; progress: MotionValue<number> }) {
  const scaleX = useTransform(progress, [i / 3, (i + 1) / 3], [0, 1]);
  return <Reveal delay={i * 0.1}>
    <div className="step-line"><motion.span style={{ scaleX }}/></div>
    <span className="mt-6 block font-mono text-xs text-muted-foreground">{n}</span>
    <h3 className="mt-3 text-2xl font-medium">{t}</h3>
    <p className="mt-2 max-w-[30ch] text-[15px] text-muted-foreground">{d}</p>
  </Reveal>;
}

/* ───────── Final CTA ───────── */

function FinalCta() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [60, -60]);
  return <section className="px-3 pb-3 sm:px-4 sm:pb-4">
    <Reveal y={60} className="cta-court mx-auto max-w-[1400px]">
      <div ref={ref} className="grid items-center md:grid-cols-2">
        <div className="relative z-10 px-7 pb-4 pt-16 sm:px-14 md:py-24">
          <span className="mono-label text-white/70">Built for everyone</span>
          <h2 className="mt-5 text-[clamp(48px,6.4vw,104px)] font-medium leading-[0.92] tracking-[-0.055em]">Your account<br/>is <span className="serif-accent">waiting.</span></h2>
          <p className="mt-6 max-w-[360px] text-white/75">Join Perk in under a minute and start getting more from your everyday.</p>
          <div className="mt-9 flex flex-wrap gap-2"><CtaLink tone="bone" size="lg">Unlock Perk<ArrowUpRight/></CtaLink></div>
        </div>
        <motion.div style={{ y }} className="relative mx-auto h-[420px] w-full max-w-[420px] md:h-[640px] md:max-w-none">
          <HoopVideo className="cta-video absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2 object-cover" label="Perk card and hoop"/>
        </motion.div>
      </div>
    </Reveal>
  </section>;
}

/* ───────── Footer ───────── */

function Footer() {
  return <footer className="section pt-20">
    <div className="flex flex-wrap items-center justify-between gap-6 border-b border-border pb-10">
      <p className="max-w-[340px] text-[15px] text-muted-foreground">The bank with perks. One account, built for everyone.</p>
      <div className="flex gap-1"><CtaLink tone="ghost">Sign in</CtaLink><CtaLink>Open account<ArrowRight/></CtaLink></div>
    </div>
    <Reveal y={80} className="select-none pb-[3vw] pt-[6vw]" aria-hidden="true"><PerkLogo className="block text-center text-[30vw] leading-[0.8] tracking-[-0.04em] md:text-[22vw]"/></Reveal>
    <div className="flex items-center justify-between border-t border-border py-6 text-sm text-muted-foreground"><span>© {new Date().getFullYear()} Perk.</span><a href="#terms" className="hover:text-ink">Terms</a></div>
    <p id="terms" className="max-w-4xl pb-12 text-xs leading-relaxed text-muted-foreground/80">Terms: This is a personal test site built for fun, not a real bank, broker or financial service. No real money is held, moved or invested. All balances, trades, profits and transactions are fictional. Trading is simulated and outcomes are chosen by the administrator; there is no live trading or promised return. Five-digit “IBANs” are internal identifiers, not valid international bank account numbers. We do not own, represent or have any affiliation with any company, brand or product named “Perk” (or similar), or any other company whose name or logo appears here. All trademarks belong to their respective owners. Nothing on this site is financial advice or an offer of any financial service.</p>
  </footer>;
}
