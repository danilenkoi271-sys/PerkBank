import { z } from 'zod';
export const ibanSchema = z.string().regex(/^\d{5}$/, 'Enter a five-digit IBAN');
export const moneySchema = z.number().finite().positive().lt(1e9).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Two decimals max');
// Validation allows up to 4×; the database only lets users above 3× once they own the max-target perk.
export const tradeInput = z.object({ amount: moneySchema, multiplier: z.number().min(1.1).max(4).refine(n => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6, 'Use 0.1× steps') });
export const ADMIN_EMAIL = 'danilenkoi271@gmail.com';
export function isAdminIdentity(email: unknown, providers: unknown, confirmed: boolean) { return typeof email === 'string' && email.toLowerCase() === ADMIN_EMAIL && Array.isArray(providers) && providers.includes('google') && confirmed; }
export function tradePayout(amount: number, multiplier: number, success: boolean) { return success ? Math.round(amount * multiplier * 100) / 100 : 0; }
/** What other members see: the real name only if its owner chose to make it public, otherwise the censored one. */
export function displayName(fullName: string, isPublic: boolean) { return isPublic ? fullName : maskName(fullName); }
export function maskName(name: string) { return name.split(/\s+/).map(s => s.slice(0,1) + '•'.repeat(Math.min(5, Math.max(2,s.length-1)))).join(' '); }
export type Trade = { id: string; amount: number; multiplier: number; status: string; payout: number; created_at: string; settled_at: string | null };
export function tradeStats(orders: Trade[], now = new Date()) {
 const settled = orders.filter(o => o.status !== 'pending');
 const wagered = orders.reduce((a,o) => a + o.amount,0);
 const pnl = settled.reduce((a,o) => a + o.payout - o.amount,0);
 const settledStake = settled.reduce((a,o)=>a+o.amount,0);
 const day = settled.filter(o => o.settled_at && o.settled_at.slice(0,10) === now.toISOString().slice(0,10));
 const dayStake = day.reduce((a,o)=>a+o.amount,0);
 return { wagered, pnl, allTimePercent: settledStake ? pnl / settledStake * 100 : 0, dailyPercent: dayStake ? day.reduce((a,o)=>a+o.payout-o.amount,0) / dayStake * 100 : 0 };
}
