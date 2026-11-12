import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server';
import { createAttemptLimiter } from './employee-panel';
import { createRateLimiter } from './rate-limit';
import type { SupabaseClient } from '@supabase/supabase-js';

export const callerIp = () => getRequestHeader('cf-connecting-ip') ?? getRequestIP({ xForwardedFor: true }) ?? 'unknown';

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
const rpcOf = (client: unknown): Rpc => (fn, args) => (client as { rpc: Rpc }).rpc(fn, args);
/** PostgREST answers like this when a database function has not been created (yet). */
const missing = (e: { code?: string; message: string } | null) => e?.code === 'PGRST202' || e?.code === '42883' || /could not find the function/i.test(e?.message ?? '');

// ---- PIN guesses -------------------------------------------------------------------------------------------------
// A five-digit PIN has only 100,000 combinations, so guesses must be limited hard. The database guard is atomic and
// shared by every server instance; until it exists, the in-memory limiters below are the fallback.
const pinByUser = createAttemptLimiter({ max: 5 });
const pinByIp = createAttemptLimiter({ max: 25 });

export type PinGate = { allowed: true; finish: (ok: boolean) => Promise<void> } | { allowed: false; retryAfterSeconds: number };

export async function beginPinAttempt(admin: SupabaseClient, userId: string): Promise<PinGate> {
  const now = Date.now(); const ip = callerIp();
  const a = pinByUser.check(userId, now); const b = pinByIp.check(ip, now);
  if (!a.allowed || !b.allowed) return { allowed: false, retryAfterSeconds: Math.ceil(Math.max(a.retryAfterMs, b.retryAfterMs) / 1000) };
  // Counted before the PIN is checked, so a burst of parallel guesses cannot all slip through.
  const db = await rpcOf(admin)('pin_guard_begin', { _uid: userId });
  const dbActive = !db.error;
  if (db.error && !missing(db.error)) throw new Error('Unlock is unavailable right now');
  if (dbActive && Number(db.data) > 0) return { allowed: false, retryAfterSeconds: Number(db.data) };
  return {
    allowed: true,
    finish: async (ok) => {
      if (ok) { pinByUser.succeed(userId); pinByIp.succeed(ip); if (dbActive) await rpcOf(admin)('pin_guard_ok', { _uid: userId }); }
      else { pinByUser.fail(userId, Date.now()); pinByIp.fail(ip, Date.now()); }
    },
  };
}

// ---- Abuse brakes ------------------------------------------------------------------------------------------------
const lookups = createRateLimiter(30, 10 * 60_000);
const transfers = createRateLimiter(20, 10 * 60_000);
const questions = createRateLimiter(30, 10 * 60_000);
export const limitLookups = (userId: string) => lookups.hit(userId);
export const limitTransfers = (userId: string) => transfers.hit(userId);
export const limitQuestions = (userId: string) => questions.hit(userId);

// ---- Money movements ---------------------------------------------------------------------------------------------
/**
 * Runs a money function as the signed-in member. Preferred path: the `*_for` variant that only the server can call, so a
 * stolen sign-in token alone cannot move funds without the PIN. Until the database change in
 * docs/security-database-request.md is applied, it falls back to the original function.
 */
export async function moneyRpc(admin: SupabaseClient, user: SupabaseClient, userId: string, name: string, args: Record<string, unknown>) {
  const strong = await rpcOf(admin)(`${name}_for`, { _uid: userId, ...args });
  if (!missing(strong.error)) return strong;
  return rpcOf(user)(name, args);
}
