import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireUnlocked } from './auth.server';
import { ibanCheckInput, perkStateSchema, purchaseInput } from './perks';

/**
 * The perk database functions are newer than the generated Supabase types, so they are called through this thin,
 * typed wrapper. Once the types are regenerated this can become a plain `supabase.rpc(...)`.
 */
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpcOf = (client: unknown): Rpc => (fn, args) => (client as { rpc: Rpc }).rpc(fn, args);

/** The user's points, owned perks and the catalog with its authoritative prices. */
export const getPerks = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireUnlocked(context.userId);
  const { data, error } = await rpcOf(context.supabase)('perk_points_state');
  if (error) throw new Error('Perks are unavailable right now');
  const parsed = perkStateSchema.safeParse(data);
  if (!parsed.success) throw new Error('Perks are unavailable right now');
  return parsed.data;
});

/** Whether a five-digit IBAN is free to take. Used for the live check while choosing a custom IBAN. */
export const checkIbanAvailable = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => ibanCheckInput.parse(d)).handler(async ({ data, context }) => {
  await requireUnlocked(context.userId);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row, error } = await supabaseAdmin.from('profiles').select('id').eq('iban', data.iban).maybeSingle();
  if (error) throw new Error('Could not check that IBAN');
  return { available: !row, self: row?.id === context.userId };
});

/**
 * Buys a perk. Everything that matters happens atomically in the database: it checks the points, applies the
 * perk's effect and records the purchase in one step.
 */
export const purchasePerk = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => purchaseInput.parse(d)).handler(async ({ data, context }) => {
  await requireUnlocked(context.userId);
  const { data: id, error } = await rpcOf(context.supabase)('purchase_perk', { _perk_id: data.perkId, _iban: data.iban ?? null });
  if (error) throw new Error(error.message);
  return { id: String(id) };
});
