import { z } from 'zod';
export const photoPathInput = z.object({ path: z.string().max(150).regex(/^[0-9a-f-]{36}\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/) });
export function validatePhotoOwner(path: string, userId: string) {
  if (!path.startsWith(`${userId}/`)) throw new Error('Invalid photo owner');
  return path;
}