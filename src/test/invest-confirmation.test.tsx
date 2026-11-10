import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Invest } from '@/components/perk/Invest';

const { place } = vi.hoisted(() => ({ place: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: () => place }));
vi.mock('@/lib/investing.functions', () => ({ placeTrade: vi.fn() }));
vi.mock('@/components/perk/PerkFeedback', () => ({ perkFeedback: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function selectAmount() {
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Investment amount slider' }), { key: 'End' });
}
describe('Investment confirmation', () => {
  it('submits the selected amount only after the success recording ends, once', async () => {
    place.mockResolvedValue({ ok: true }); const onPlaced = vi.fn();
    render(<Invest balance={100} onPlaced={onPlaced}/>);
    selectAmount(); fireEvent.click(screen.getByRole('button', { name: 'Place investment' }));
    expect(place).not.toHaveBeenCalled();
    const video = screen.getByLabelText('Face ID success');
    fireEvent.ended(video); fireEvent.ended(video);
    await waitFor(() => expect(onPlaced).toHaveBeenCalledTimes(1));
    expect(place).toHaveBeenCalledTimes(1);
    expect(place).toHaveBeenCalledWith({ data: { amount: 100, multiplier: 1.5 } });
  });
  it('does not submit when the recording is cancelled', () => {
    render(<Invest balance={100} onPlaced={vi.fn()}/>);
    selectAmount(); fireEvent.click(screen.getByRole('button', { name: 'Place investment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Face ID' }));
    expect(place).not.toHaveBeenCalled();
  });
});