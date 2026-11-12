import { z } from 'zod';
import { ibanSchema, moneySchema } from './investing';
export const pinSchema = z.string().regex(/^\d{5}$/, 'Your PIN is exactly 5 digits');
/** PINs everyone tries first. Refused when choosing a PIN (existing PINs still unlock). */
const OBVIOUS = new Set(['00000','11111','22222','33333','44444','55555','66666','77777','88888','99999','12345','54321','01234','43210','12321','13579','24680','11223','00123','98765']);
export const isObviousPin = (pin: string) => OBVIOUS.has(pin);
export const newPinSchema = pinSchema.refine(p => !isObviousPin(p), 'Pick a PIN that is harder to guess');
export const setupInput = z.object({ full_name: z.string().trim().min(1, 'Add your name').max(60), pin: newPinSchema });
export const sendInput = z.object({ iban: ibanSchema, amount: moneySchema, note: z.string().max(200).optional() });
