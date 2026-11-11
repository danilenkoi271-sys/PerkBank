import { Hash, Rocket, type LucideIcon } from 'lucide-react';

/**
 * How each perk looks in the shop. Prices and rules come from the database; this is only presentation.
 * To add a perk: add its row to the catalog table, implement it in the purchase function, then add an entry here.
 * A perk the database knows about but this list doesn't is simply not shown yet.
 */
export const PERK_UI: Record<string, { title: string; description: string; icon: LucideIcon }> = {
  custom_iban: { title: 'Custom IBAN', description: 'Choose your own five-digit IBAN, a number people will remember. Changing it again later costs the same.', icon: Hash },
  max_target_4x: { title: 'Max target 4×', description: 'Raise your highest investment target from 3× to 4×. Yours for good.', icon: Rocket },
};
