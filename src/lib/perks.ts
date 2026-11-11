import { z } from 'zod';
import { ibanSchema } from './investing';

/**
 * Perk points: every $1 invested earns 10 points, whether the trade wins or loses. Points are never stored as a
 * running counter. The balance is always `earned − spent`, derived from the trade history and the purchase history,
 * so it cannot drift. The same rules are enforced in the database (see docs/perks-database-request.md).
 */
export const POINTS_PER_DOLLAR = 10;
export const DEFAULT_MAX_MULTIPLIER = 3;

/** Points earned by one stake. Works in whole cents so floating point can never shave off a point. */
export function pointsFor(amount: number) {
  return Math.max(0, Math.floor(Math.round(amount * 100) / 10));
}

/** What the database returns for the signed-in user. Parsed strictly, so a malformed answer never reaches the UI. */
export const perkStateSchema = z.object({
  earned: z.number().int().nonnegative(),
  spent: z.number().int().nonnegative(),
  balance: z.number().int(),
  owned: z.record(z.string(), z.number().int().nonnegative()),
  catalog: z.array(z.object({ id: z.string().min(1), cost: z.number().int().positive(), repeatable: z.boolean() })),
  max_multiplier: z.number().min(1.1).max(10),
});
export type PerkState = z.infer<typeof perkStateSchema>;
export type CatalogEntry = PerkState['catalog'][number];

export const purchaseInput = z.object({ perkId: z.string().min(1).max(40), iban: ibanSchema.optional() });
export const ibanCheckInput = z.object({ iban: ibanSchema });

export const owns = (state: PerkState, perkId: string) => (state.owned[perkId] ?? 0) > 0;
export const shortfall = (balance: number, cost: number) => Math.max(0, cost - balance);

export type BuyStatus = 'ok' | 'owned' | 'points';
/** Whether a perk can be bought right now, and if not, why. The database makes the final call. */
export function buyStatus(state: PerkState, perk: CatalogEntry): BuyStatus {
  if (!perk.repeatable && owns(state, perk.id)) return 'owned';
  return state.balance >= perk.cost ? 'ok' : 'points';
}

/** The highest target multiplier this user may choose. Falls back to the standard limit when perks are unavailable. */
export const maxMultiplierOf = (state: PerkState | undefined) => state?.max_multiplier ?? DEFAULT_MAX_MULTIPLIER;

export const formatPoints = (n: number) => `${new Intl.NumberFormat('en-US').format(n)} pts`;
