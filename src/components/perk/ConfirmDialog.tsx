import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Trash2, X } from 'lucide-react';
import { Overlay } from './AppShell';
import { EASE } from './motion';

type Tone = 'success' | 'danger' | 'neutral';
export type ConfirmOptions = {
  title: string;
  body?: string;
  /** Small label/value list shown in the dialog, e.g. trader and stake. */
  rows?: [label: string, value: string][];
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Tone;
};

const toneStyle: Record<Tone, { badge: string; button: string; icon: ReactNode }> = {
  success: { badge: 'bg-success/12 text-success', button: 'bg-success text-white hover:bg-success/90', icon: <Check className="h-6 w-6"/> },
  danger: { badge: 'bg-destructive/12 text-destructive', button: 'bg-destructive text-white hover:bg-destructive/90', icon: <X className="h-6 w-6"/> },
  neutral: { badge: 'bg-bone text-ink', button: 'bg-ink text-bone hover:bg-ink/85', icon: <Trash2 className="h-5 w-5"/> },
};

/**
 * Promise-based replacement for window.confirm:
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title: 'Delete?', confirmLabel: 'Delete', tone: 'danger' })) …
 * Render `dialog` once anywhere in the page.
 */
export function useConfirm() {
  const [open, setOpen] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    openRef.current?.resolve(false);
    setOpen({ ...options, resolve });
  }), []);
  const close = useCallback((ok: boolean) => { openRef.current?.resolve(ok); setOpen(null); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const tone = toneStyle[open?.tone ?? 'neutral'];
  const dialog = <Overlay><AnimatePresence>{open && <motion.div key="confirm" className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-3 backdrop-blur-md sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => close(false)}>
    <motion.div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={open.body ? 'confirm-body' : undefined} className="w-full max-w-[400px] rounded-[28px] bg-card p-6 text-card-foreground shadow-[0_40px_80px_-30px_rgb(11_12_14/.55)]" initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} transition={{ duration: 0.5, ease: EASE }} onClick={e => e.stopPropagation()}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${tone.badge}`}>{tone.icon}</span>
      <h2 id="confirm-title" className="mt-5 text-[24px] font-medium leading-tight">{open.title}</h2>
      {open.body && <p id="confirm-body" className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{open.body}</p>}
      {open.rows && <dl className="mt-5 divide-y divide-border overflow-hidden rounded-2xl bg-bone">{open.rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-4 px-4 py-3"><dt className="mono-label text-muted-foreground">{k}</dt><dd className="truncate text-[15px] font-medium tabular-nums">{v}</dd></div>)}</dl>}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button type="button" autoFocus onClick={() => close(false)} className="h-12 rounded-full bg-bone text-[15px] font-medium text-ink transition hover:bg-secondary active:scale-[0.97]">{open.cancelLabel ?? 'Cancel'}</button>
        <button type="button" onClick={() => close(true)} className={`h-12 rounded-full px-3 text-[15px] font-medium transition active:scale-[0.97] ${tone.button}`}>{open.confirmLabel}</button>
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence></Overlay>;

  return { confirm, dialog };
}
