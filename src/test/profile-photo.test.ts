import { describe, expect, it } from 'vitest';
import { photoPathInput, validatePhotoOwner } from '@/lib/profile-photo';
describe('Profile photo ownership', () => {
  const owner = '05d4d416-4cc3-41b8-b823-5f53db9170c5';
  it('accepts a supported photo in the signed-in user folder', () => { const path = `${owner}/portrait.webp`; expect(photoPathInput.parse({ path }).path).toBe(path); expect(validatePhotoOwner(path, owner)).toBe(path); });
  it('rejects another user folder', () => { expect(() => validatePhotoOwner(`${owner}/portrait.webp`, 'someone-else')).toThrow('Invalid photo owner'); });
  it('rejects SVG and path traversal', () => { expect(photoPathInput.safeParse({ path: `${owner}/photo.svg` }).success).toBe(false); expect(photoPathInput.safeParse({ path: `${owner}/../photo.webp` }).success).toBe(false); });
});