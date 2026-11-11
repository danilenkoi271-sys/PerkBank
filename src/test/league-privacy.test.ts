import { describe, expect, it } from 'vitest';
import { displayName, maskName } from '@/lib/investing';

describe('how a member’s name is shown on the league', () => {
  it('is censored unless the member chose to make it public', () => {
    expect(displayName('Jordan Miles', false)).toBe(maskName('Jordan Miles'));
    expect(displayName('Jordan Miles', false)).not.toContain('ordan');
    expect(displayName('Jordan Miles', false)).toMatch(/^J•+ M•+$/);
  });
  it('is the full name once the member made it public', () => {
    expect(displayName('Jordan Miles', true)).toBe('Jordan Miles');
  });
  it('treats the missing setting as private, so nobody is exposed by accident', () => {
    // the server passes `public_name === true`, so undefined or null must mean private
    const pass = (v: boolean | null | undefined) => displayName('Jordan Miles', v === true);
    expect(pass(undefined)).toBe(maskName('Jordan Miles'));
    expect(pass(null)).toBe(maskName('Jordan Miles'));
    expect(pass(false)).toBe(maskName('Jordan Miles'));
    expect(pass(true)).toBe('Jordan Miles');
  });
  it('a single-word or very short name is still censored', () => {
    expect(displayName('Sam', false)).not.toBe('Sam');
    expect(displayName('Al', false)).not.toBe('Al');
  });
});
