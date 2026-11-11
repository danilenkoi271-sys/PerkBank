import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerksShop } from '@/components/perk/PerksShop';
import type { PerkState } from '@/lib/perks';

const { buy, check, feedback } = vi.hoisted(() => ({ buy: vi.fn(), check: vi.fn(), feedback: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/perks.functions', () => ({ purchasePerk: buy, checkIbanAvailable: check, getPerks: vi.fn() }));
vi.mock('@/components/perk/PerkFeedback', () => ({ perkFeedback: feedback }));
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const state = (over: Partial<PerkState> = {}): PerkState => ({
  earned: 1600, spent: 0, balance: 1600, owned: {},
  catalog: [{ id: 'custom_iban', cost: 500, repeatable: true }, { id: 'max_target_4x', cost: 1000, repeatable: false }],
  max_multiplier: 3, ...over,
});
const shop = (s = state(), onChanged = vi.fn()) => { render(<PerksShop state={s} iban="48217" onChanged={onChanged}/>); return onChanged; };
const faceIdSucceeds = () => fireEvent.ended(screen.getByLabelText('Face ID success'));

describe('the perks shop', () => {
  it('shows the points balance and each perk with its price', () => {
    shop();
    expect(screen.getByLabelText('Perk points balance')).toBeTruthy();
    expect(screen.getByText('Custom IBAN')).toBeTruthy();
    expect(screen.getByText('Max target 4×')).toBeTruthy();
    expect(screen.getByText('500 pts')).toBeTruthy();
    expect(screen.getByText('1,000 pts')).toBeTruthy();
    expect(screen.getByText(/10 points for every \$1/)).toBeTruthy();
  });

  it('buys a perk only after the Face ID success animation ends, exactly once', async () => {
    buy.mockResolvedValue({ id: 'p1' }); const onChanged = shop();
    fireEvent.click(screen.getByRole('button', { name: /Confirm with Face ID · 1,000 pts/ }));
    expect(buy).not.toHaveBeenCalled(); // the animation is playing, nothing is bought yet
    const video = screen.getByLabelText('Face ID success');
    fireEvent.ended(video); fireEvent.ended(video); // a duplicate event must not buy twice
    await waitFor(() => expect(buy).toHaveBeenCalledTimes(1));
    expect(buy).toHaveBeenCalledWith({ data: { perkId: 'max_target_4x' } });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(feedback).toHaveBeenCalledWith('Perk unlocked', 'success', 'Max target 4×');
  });

  it('buys nothing when Face ID is cancelled', () => {
    buy.mockResolvedValue({ id: 'p1' }); shop();
    fireEvent.click(screen.getByRole('button', { name: /Confirm with Face ID · 1,000 pts/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Face ID' }));
    expect(buy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Face ID success')).toBeNull();
  });

  it('shows the error and keeps the shop usable when the purchase is refused', async () => {
    buy.mockRejectedValue(new Error('Not enough points')); const onChanged = shop();
    fireEvent.click(screen.getByRole('button', { name: /Confirm with Face ID · 1,000 pts/ }));
    faceIdSucceeds();
    await waitFor(() => expect(feedback).toHaveBeenCalledWith('Not enough points', 'error'));
    expect(onChanged).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: /Confirm with Face ID · 1,000 pts/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('cannot buy a perk you cannot afford, and says how many points are missing', () => {
    shop(state({ balance: 300, earned: 300 }));
    expect(screen.getAllByText('Need 200 pts more').length).toBe(1);
    expect(screen.getByText('Need 700 pts more')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Confirm with Face ID/ })).toBeNull();
    expect((screen.getByText('Need 700 pts more').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a one-time perk as owned and does not offer it again', () => {
    shop(state({ owned: { max_target_4x: 1 }, max_multiplier: 4 }));
    expect(screen.getByText('Owned')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /1,000 pts/ })).toBeNull();
  });
});

describe('buying a custom IBAN', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Choose an IBAN' }));
  const type = (v: string) => fireEvent.change(screen.getByLabelText('New IBAN'), { target: { value: v } });

  it('checks the IBAN is free, then buys it after Face ID with that exact IBAN', async () => {
    check.mockResolvedValue({ available: true, self: false }); buy.mockResolvedValue({ id: 'p2' }); const onChanged = shop();
    open(); type('48210');
    await screen.findByText('That IBAN is free', {}, { timeout: 3000 });
    expect(check).toHaveBeenCalledWith({ data: { iban: '48210' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm with Face ID · 500 pts/ }));
    expect(buy).not.toHaveBeenCalled();
    faceIdSucceeds();
    await waitFor(() => expect(buy).toHaveBeenCalledWith({ data: { perkId: 'custom_iban', iban: '48210' } }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('will not let you buy an IBAN that is taken', async () => {
    check.mockResolvedValue({ available: false, self: false }); shop();
    open(); type('48210');
    await screen.findByText('That IBAN is taken', {}, { timeout: 3000 });
    expect((screen.getByRole('button', { name: /Confirm with Face ID · 500 pts/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('refuses your current IBAN without asking the server', async () => {
    shop(); open(); type('48217');
    await screen.findByText("That's already your IBAN");
    expect(check).not.toHaveBeenCalled();
  });

  it('ignores anything that is not a digit and stops at five', () => {
    shop(); open(); type('4a8b2 1c0999');
    expect((screen.getByLabelText('New IBAN') as HTMLInputElement).value).toBe('48210');
  });

  it('does not offer the IBAN form when there are not enough points', () => {
    shop(state({ balance: 100, earned: 100 }));
    expect(screen.queryByRole('button', { name: 'Choose an IBAN' })).toBeNull();
    expect(screen.getByText('Need 400 pts more')).toBeTruthy();
  });
});
