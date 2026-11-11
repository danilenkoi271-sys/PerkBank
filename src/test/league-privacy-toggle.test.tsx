import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaguePrivacy } from '@/components/perk/LeaguePrivacy';
import { maskName } from '@/lib/investing';

const { get, set, feedback } = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), feedback: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/investing.functions', () => ({ getMyLeaderboardPrivacy: get, setLeaderboardPrivacy: set, getLeaderboard: vi.fn() }));
vi.mock('@/components/perk/PerkFeedback', () => ({ perkFeedback: feedback }));
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const NAME = 'Jordan Miles';
const show = () => { const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={qc}><LeaguePrivacy name={NAME}/></QueryClientProvider>); return qc; };
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLButtonElement;

describe('the name privacy toggle', () => {
  it('starts private and shows how others see you', async () => {
    get.mockResolvedValue({ available: true, public: false }); show();
    await waitFor(() => expect(radio('Private').getAttribute('aria-checked')).toBe('true'));
    expect(radio('Public').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(maskName(NAME))).toBeTruthy();
    expect(screen.queryByText(NAME)).toBeNull();
  });

  it('asks before making a name public, and changes nothing if you keep it private', async () => {
    get.mockResolvedValue({ available: true, public: false }); show();
    await waitFor(() => expect(radio('Public').disabled).toBe(false));
    fireEvent.click(radio('Public'));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Show your name on the league?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep private' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(set).not.toHaveBeenCalled();
    expect(radio('Private').getAttribute('aria-checked')).toBe('true');
  });

  it('makes the name public once confirmed, and shows the full name', async () => {
    get.mockResolvedValue({ available: true, public: false }); set.mockResolvedValue({ public: true }); const qc = show();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    await waitFor(() => expect(radio('Public').disabled).toBe(false));
    fireEvent.click(radio('Public'));
    fireEvent.click(await screen.findByRole('button', { name: 'Make it public' }));
    await waitFor(() => expect(set).toHaveBeenCalledWith({ data: { public: true } }));
    await waitFor(() => expect(radio('Public').getAttribute('aria-checked')).toBe('true'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull()); // the dialog has finished closing
    expect(screen.getByText(NAME)).toBeTruthy();
    expect(feedback).toHaveBeenCalledWith('Your name is now public');
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['leaderboard'] })); // the league refreshes
  });

  it('goes back to private straight away, with no question', async () => {
    get.mockResolvedValue({ available: true, public: true }); set.mockResolvedValue({ public: false }); show();
    await waitFor(() => expect(radio('Public').getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(radio('Private'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(set).toHaveBeenCalledWith({ data: { public: false } }));
    await waitFor(() => expect(screen.getByText(maskName(NAME))).toBeTruthy());
    expect(feedback).toHaveBeenCalledWith('Your name is now private');
  });

  it('undoes the change and says so when saving fails', async () => {
    get.mockResolvedValue({ available: true, public: true }); set.mockRejectedValue(new Error('Your name privacy could not be changed right now')); show();
    await waitFor(() => expect(radio('Public').getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(radio('Private'));
    await waitFor(() => expect(feedback).toHaveBeenCalledWith('Your name privacy could not be changed right now', 'error'));
    await waitFor(() => expect(radio('Public').getAttribute('aria-checked')).toBe('true')); // rolled back
  });

  it('does nothing when you pick the mode you are already in', async () => {
    get.mockResolvedValue({ available: true, public: false }); show();
    await waitFor(() => expect(radio('Private').disabled).toBe(false));
    fireEvent.click(radio('Private'));
    expect(set).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('is switched off, and says why, until the database supports it', async () => {
    get.mockResolvedValue({ available: false, public: false }); show();
    await screen.findByText('Name privacy settings are coming soon.');
    expect(radio('Private').disabled).toBe(true);
    expect(radio('Public').disabled).toBe(true);
  });

  it('treats a failed lookup as unavailable and never as public', async () => {
    get.mockRejectedValue(new Error('boom')); show();
    await screen.findByText('Name privacy settings are coming soon.');
    expect(radio('Public').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(NAME)).toBeNull();
  });
});
