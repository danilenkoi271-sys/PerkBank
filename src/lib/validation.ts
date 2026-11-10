import { z } from 'zod';
import { ibanSchema, moneySchema } from './investing';
export const pinSchema = z.string().regex(/^\d{5}$/, 'Your PIN is exactly 5 digits');
export const setupInput = z.object({ full_name: z.string().trim().min(1, 'Add your name').max(60), pin: pinSchema });
export const sendInput = z.object({ iban: ibanSchema, amount: moneySchema, note: z.string().max(200).optional() });
