import { useSession } from '@tanstack/react-start/server';

/** How long a successful password entry keeps the employee panel open. */
export const PANEL_SESSION_MS = 8 * 60 * 60 * 1000;

type PanelSession = { unlockedAt?: number };

/** The employee panel has its own cookie, separate from the account session, so the two can never unlock each other. */
export function getPanelSession() {
  return useSession<PanelSession>({
    password: process.env['SESSION_SECRET']!,
    name: 'perk-employee-panel',
    maxAge: PANEL_SESSION_MS / 1000,
    cookie: { httpOnly: true, secure: true, sameSite: 'none', path: '/' },
  });
}

export const isPanelUnlocked = (data: { unlockedAt?: number }, now = Date.now()) =>
  typeof data.unlockedAt === 'number' && data.unlockedAt <= now && now - data.unlockedAt < PANEL_SESSION_MS;
