import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react';
import { formatMoney } from '@/lib/categories';

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({ children, delay = 0, y = 28, className, as = 'div', ...rest }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'section' | 'li' | 'p' | 'span' } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;
  return <Tag className={className} initial={reduce ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -12% 0px' }} transition={{ duration: 0.9, ease: EASE, delay }} {...rest}>{children}</Tag>;
}

/** Splits a line into words that rise out of a mask one after another. */
export function MaskWords({ text, className, delay = 0, stagger = 0.06, inView = true }: { text: string; className?: string; delay?: number; stagger?: number; inView?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  // Observe the whole line: the individual words start clipped by their masks, so they never "intersect".
  const seen = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });
  const show = !inView || seen;
  const words = text.split(' ');
  return <span ref={ref} className={className}>{words.map((w, i) => <span key={i} className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em] align-bottom">
    <motion.span className="inline-block" initial={reduce ? false : { y: '110%' }} animate={show ? { y: '0%' } : { y: '110%' }} transition={{ duration: 1, ease: EASE, delay: delay + i * stagger }}>{w}{i < words.length - 1 ? '\u00a0' : ''}</motion.span>
  </span>)}</span>;
}

/** Counts a money amount up from zero (or from its previous value) with an easing curve. */
export function CountUp({ value, className, split = false }: { value: number; className?: string; split?: boolean }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const [text, setText] = useState(() => formatMoney(reduce ? value : 0));
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  useEffect(() => mv.on('change', v => setText(formatMoney(v))), [mv]);
  useEffect(() => {
    if (!seen) return;
    if (reduce) { mv.set(value); return; }
    const c = animate(mv, value, { duration: 1.4, ease: EASE });
    return () => c.stop();
  }, [value, seen, reduce, mv]);
  if (!split) return <span ref={ref} className={className}>{text}</span>;
  const dot = text.lastIndexOf('.');
  return <span ref={ref} className={className}>{dot > -1 ? <>{text.slice(0, dot)}<span className="cents">{text.slice(dot)}</span></> : text}</span>;
}

/** A word-by-word highlight driven by a 0→1 progress value. */
export function ScrollWords({ text, progress, className }: { text: string; progress: import('motion/react').MotionValue<number>; className?: string }) {
  const words = text.split(' ');
  return <p className={className}>{words.map((w, i) => <Word key={i} progress={progress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>)}</p>;
}
function Word({ children, progress, range }: { children: string; progress: import('motion/react').MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const accent = children.startsWith('*');
  const word = accent ? children.replace(/\*/g, '') : children;
  return <><motion.span style={{ opacity }} className={accent ? 'serif-accent' : undefined}>{word}</motion.span>{' '}</>;
}
