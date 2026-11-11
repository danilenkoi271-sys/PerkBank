import { describe, expect, it } from 'vitest';
import { buyStatus, DEFAULT_MAX_MULTIPLIER, ibanCheckInput, maxMultiplierOf, owns, perkStateSchema, pointsFor, purchaseInput, shortfall, type PerkState } from '@/lib/perks';

const state = (over: Partial<PerkState> = {}): PerkState => ({
  earned: 1600, spent: 100, balance: 1500, owned: {},
  catalog: [{ id: 'custom_iban', cost: 500, repeatable: true }, { id: 'max_target_4x', cost: 1000, repeatable: false }],
  max_multiplier: 3, ...over,
});

describe('perk points', () => {
  it('earns 10 points for every $1 invested', () => {
    expect(pointsFor(1)).toBe(10);
    expect(pointsFor(100)).toBe(1000);
    expect(pointsFor(250.5)).toBe(2505);
  });
  it('rounds down to whole points, in whole cents, so floating point never changes the answer', () => {
    expect(pointsFor(12.34)).toBe(123);
    expect(pointsFor(0.07)).toBe(0);
    expect(pointsFor(0.57)).toBe(5);
    expect(pointsFor(4.35)).toBe(43);
    for (let cents = 1; cents <= 20_000; cents++) expect(pointsFor(cents / 100)).toBe(Math.floor(cents / 10));
  });
  it('never goes negative', () => { expect(pointsFor(-5)).toBe(0); expect(pointsFor(0)).toBe(0); });
});

describe('buying perks', () => {
  const iban = state().catalog[0]!; const boost = state().catalog[1]!;
  it('allows a perk you can afford', () => { expect(buyStatus(state(), iban)).toBe('ok'); expect(buyStatus(state(), boost)).toBe('ok'); });
  it('allows exactly enough points', () => { expect(buyStatus(state({ balance: 500 }), iban)).toBe('ok'); });
  it('refuses when points are short, and says by how much', () => {
    expect(buyStatus(state({ balance: 499 }), iban)).toBe('points');
    expect(shortfall(300, 500)).toBe(200);
    expect(shortfall(900, 500)).toBe(0);
  });
  it('a one-time perk can only be owned once, a repeatable one can be bought again', () => {
    const owned = state({ owned: { max_target_4x: 1, custom_iban: 2 } });
    expect(owns(owned, 'max_target_4x')).toBe(true);
    expect(buyStatus(owned, boost)).toBe('owned');
    expect(buyStatus(owned, iban)).toBe('ok');
  });
  it('owning the perk shows as owned even when points are short', () => {
    expect(buyStatus(state({ balance: 0, owned: { max_target_4x: 1 } }), boost)).toBe('owned');
  });
});

describe('max target', () => {
  it('is 3× by default and whatever the database says once the perk is owned', () => {
    expect(maxMultiplierOf(undefined)).toBe(DEFAULT_MAX_MULTIPLIER);
    expect(maxMultiplierOf(state())).toBe(3);
    expect(maxMultiplierOf(state({ max_multiplier: 4 }))).toBe(4);
  });
});

describe('what the database sends back', () => {
  it('accepts a well-formed state', () => { expect(perkStateSchema.safeParse(state()).success).toBe(true); });
  it('rejects anything malformed instead of passing it to the UI', () => {
    expect(perkStateSchema.safeParse({}).success).toBe(false);
    expect(perkStateSchema.safeParse(null).success).toBe(false);
    expect(perkStateSchema.safeParse({ ...state(), catalog: [{ id: 'x', cost: -5, repeatable: false }] }).success).toBe(false);
    expect(perkStateSchema.safeParse({ ...state(), balance: 'lots' }).success).toBe(false);
    expect(perkStateSchema.safeParse({ ...state(), max_multiplier: 50 }).success).toBe(false);
  });
});

describe('purchase requests', () => {
  it('accepts a perk id, with or without a five-digit IBAN', () => {
    expect(purchaseInput.safeParse({ perkId: 'max_target_4x' }).success).toBe(true);
    expect(purchaseInput.safeParse({ perkId: 'custom_iban', iban: '48210' }).success).toBe(true);
  });
  it('rejects empty ids and anything that is not exactly five digits', () => {
    expect(purchaseInput.safeParse({ perkId: '' }).success).toBe(false);
    for (const iban of ['1234', '123456', 'abcde', '12 34', '']) {
      expect(purchaseInput.safeParse({ perkId: 'custom_iban', iban }).success).toBe(false);
      expect(ibanCheckInput.safeParse({ iban }).success).toBe(false);
    }
  });
});
