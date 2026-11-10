import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { PerkLogo } from './PerkCard';
import { EASE } from './motion';

/** Full-screen loading state shared by the signed-in pages. */
export function AppLoading({ label }: { label: string }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bone text-ink" role="status" aria-live="polite">
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE }}><PerkLogo className="text-5xl"/></motion.div>
    <div className="flex gap-1.5" aria-hidden="true"><span className="loader-dot"/><span className="loader-dot"/><span className="loader-dot"/></div>
    <span className="sr-only">{label}</span>
  </div>;
}

export function AppError({ message, action }: { message: string; action: ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bone px-6 text-center text-ink">
    <PerkLogo className="text-4xl"/>
    <p className="max-w-xs text-muted-foreground">{message}</p>
    {action}
  </div>;
}

/** Soft rise-in used whenever the signed-in view changes. */
export function ViewTransition({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return <motion.div key={id} className={className} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.55, ease: EASE }}>{children}</motion.div>;
}

export function PageHeading({ eyebrow, title, accent, children }: { eyebrow: string; title: string; accent?: string; children?: ReactNode }) {
  return <header className="mb-8 sm:mb-10">
    <span className="mono-label text-muted-foreground">{eyebrow}</span>
    <h1 className="mt-3 text-[clamp(40px,6vw,64px)] font-medium leading-[0.95]">{title}{accent && <> <span className="serif-accent">{accent}</span></>}</h1>
    {children}
  </header>;
}

/** Renders overlays at the document root so animated/transformed parents can't clip a fixed layer. */
export function Overlay({ children }: { children: ReactNode }) {
  return typeof document === 'undefined' ? null : createPortal(children, document.body);
}
