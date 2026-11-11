import { z } from 'zod';
import { asDisplayed, heldWinnings, isPlayingOut } from './live-trade';

/**
 * The employee panel (/admin). It is read-only and shows what the manager dashboard shows, without the trade approval
 * queue. It is guarded by one shared password kept in the EMPLOYEE_PANEL_PASSWORD secret, never in the code.
 */
export const panelPasswordInput = z.object({ password: z.string().min(1).max(200) });

/** Compares in constant time, and a missing or empty expected password never matches anything. */
export async function passwordMatches(input: string, expected: string | undefined) {
  if (!expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(input)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  const x = new Uint8Array(a); const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Slows down password guessing: after `max` wrong attempts from one place, that place is locked out for `lockMs`.
 * It lives in memory, so it is best effort on a server that restarts. The password is the real protection.
 */
export function createAttemptLimiter({ max = 5, windowMs = 15 * 60_000, lockMs = 15 * 60_000 }: { max?: number; windowMs?: number; lockMs?: number } = {}) {
  const seen = new Map<string, { fails: number; first: number; lockedUntil: number }>();
  const prune = (now: number) => { if (seen.size > 5000) for (const [k, v] of seen) if (v.lockedUntil < now && now - v.first > windowMs) seen.delete(k); };
  return {
    check(key: string, now: number) {
      const e = seen.get(key);
      return e && e.lockedUntil > now ? { allowed: false, retryAfterMs: e.lockedUntil - now } : { allowed: true, retryAfterMs: 0 };
    },
    fail(key: string, now: number) {
      prune(now);
      const old = seen.get(key);
      const e = old && now - old.first <= windowMs ? old : { fails: 0, first: now, lockedUntil: 0 };
      e.fails += 1;
      if (e.fails >= max) { e.lockedUntil = now + lockMs; e.fails = 0; e.first = now; }
      seen.set(key, e);
    },
    succeed(key: string) { seen.delete(key); },
  };
}

type Profile = { id: string; full_name: string; iban: string | null };
type Account = { id: string; user_id: string | null; balance: number };
type Txn = { id: string; account_id: string; title: string; category: string; amount: number; note: string | null; reference: string; created_at: string; icon: string | null; order_id: string | null };
type Order = { id: string; user_id: string; amount: number; multiplier: number; status: string; payout: number; created_at: string; settled_at: string | null };

export type EmployeeView = {
  users: { id: string; full_name: string; iban: string | null; balance: number }[];
  txns: { id: string; title: string; category: string; amount: number; note: string | null; reference: string; created_at: string; icon: string | null; owner: string }[];
  orders: { id: string; owner: string; amount: number; multiplier: number; status: 'success' | 'failed'; payout: number; created_at: string; settled_at: string }[];
};

/**
 * Builds what an employee may see. Trades waiting for the manager's decision are left out entirely, and so is a trade
 * whose chart is still playing its result (it still counts as live). Account ids never leave the server.
 */
export function buildEmployeeView({ profiles, accounts, txns, orders, now }: { profiles: Profile[]; accounts: Account[]; txns: Txn[]; orders: Order[]; now: number }): EmployeeView {
  const nameOf = (userId: string | null) => profiles.find(p => p.id === userId)?.full_name ?? 'Legacy account';
  const inFlight = new Set(orders.filter(o => isPlayingOut(o, now)).map(o => o.id));
  return {
    users: profiles.map(p => {
      const balance = Number(accounts.find(a => a.user_id === p.id)?.balance ?? 0);
      return { id: p.id, full_name: p.full_name, iban: p.iban, balance: Math.max(0, balance - heldWinnings(orders.filter(o => o.user_id === p.id), now)) };
    }),
    txns: txns
      .filter(t => !(t.category === 'investment_payout' && t.order_id && inFlight.has(t.order_id)))
      .map(t => ({ id: t.id, title: t.title, category: t.category, amount: t.amount, note: t.note, reference: t.reference, created_at: t.created_at, icon: t.icon, owner: nameOf(accounts.find(a => a.id === t.account_id)?.user_id ?? null) })),
    orders: orders
      .map(o => asDisplayed(o, now))
      .filter((o): o is typeof o & { status: 'success' | 'failed'; settled_at: string } => (o.status === 'success' || o.status === 'failed') && o.settled_at !== null)
      .map(o => ({ id: o.id, owner: nameOf(o.user_id), amount: o.amount, multiplier: o.multiplier, status: o.status, payout: o.payout, created_at: o.created_at, settled_at: o.settled_at })),
  };
}
