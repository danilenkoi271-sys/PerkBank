import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server';
import { buildEmployeeView, createAttemptLimiter, panelPasswordInput, passwordMatches } from './employee-panel';
import { getPanelSession, isPanelUnlocked } from './employee-session.server';

// One limiter for the whole server process. See createAttemptLimiter for what that does and does not guarantee.
const limiter = createAttemptLimiter({ max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 });
const secret = () => process.env['EMPLOYEE_PANEL_PASSWORD'];
const caller = () => getRequestHeader('cf-connecting-ip') ?? getRequestIP({ xForwardedFor: true }) ?? 'unknown';

/** Whether the panel is set up (the password secret exists) and whether this browser has already unlocked it. */
export const getEmployeePanelState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getPanelSession();
  return { configured: Boolean(secret()), unlocked: isPanelUnlocked(session.data) };
});

/** Checks the shared password. Wrong guesses are slowed down and, after a few, locked out for a while. */
export const unlockEmployeePanel = createServerFn({ method: 'POST' }).inputValidator(d => panelPasswordInput.parse(d)).handler(async ({ data }) => {
  const key = caller(); const now = Date.now();
  if (!secret()) return { ok: false as const, reason: 'not_configured' as const };
  const gate = limiter.check(key, now);
  if (!gate.allowed) return { ok: false as const, reason: 'locked' as const, retryAfterSeconds: Math.ceil(gate.retryAfterMs / 1000) };
  if (!(await passwordMatches(data.password, secret()))) {
    limiter.fail(key, now);
    await new Promise(r => setTimeout(r, 400)); // a wrong guess is never instant
    return { ok: false as const, reason: 'wrong' as const };
  }
  limiter.succeed(key);
  await (await getPanelSession()).update({ unlockedAt: Date.now() });
  return { ok: true as const };
});

export const lockEmployeePanel = createServerFn({ method: 'POST' }).handler(async () => {
  await (await getPanelSession()).clear();
  return { ok: true as const };
});

/**
 * Everything the employee panel shows. It re-checks the unlock on every single call, reads with the server's own
 * credentials (employees are not signed in as anyone) and only ever returns the filtered, read-only view.
 */
export const getEmployeePanelData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getPanelSession();
  if (!secret() || !isPanelUnlocked(session.data)) throw new Error('Locked');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const [p, a, t, o] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,iban'),
    supabaseAdmin.from('accounts').select('id,user_id,balance'),
    supabaseAdmin.from('transactions').select('*').order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('trade_orders').select('*').order('created_at', { ascending: false }),
  ]);
  if (p.error || a.error || t.error || o.error) throw new Error('Data unavailable');
  return buildEmployeeView({
    profiles: p.data,
    accounts: a.data.map(x => ({ ...x, balance: Number(x.balance) })),
    txns: t.data.map(x => ({ ...x, amount: Number(x.amount) })),
    orders: o.data.map(x => ({ ...x, amount: Number(x.amount), multiplier: Number(x.multiplier), payout: Number(x.payout) })),
    now: Date.now(),
  });
});
