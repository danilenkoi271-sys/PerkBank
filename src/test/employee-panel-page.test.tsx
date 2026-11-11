import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeePanel } from '@/routes/admin';

const { getState, unlock, lock, getData } = vi.hoisted(() => ({ getState: vi.fn(), unlock: vi.fn(), lock: vi.fn(), getData: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/employee-panel.functions', () => ({ getEmployeePanelState: getState, unlockEmployeePanel: unlock, lockEmployeePanel: lock, getEmployeePanelData: getData }));
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const view = {
  users: [{ id: 'u1', full_name: 'Alex Rivera', iban: '48217', balance: 1000 }, { id: 'u2', full_name: 'Jordan Miles', iban: '48210', balance: 500 }],
  txns: [{ id: 't1', title: 'Spotify', category: 'subscriptions', amount: -11.99, note: null, reference: 'PK1', created_at: ago(60_000), icon: null, owner: 'Alex Rivera' }],
  orders: [{ id: 'o1', owner: 'Jordan Miles', amount: 150, multiplier: 1.8, status: 'success' as const, payout: 270, created_at: ago(900_000), settled_at: ago(300_000) }],
};
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EmployeePanel/></QueryClientProvider>);
const type = (v: string) => fireEvent.change(screen.getByLabelText(/Password/), { target: { value: v } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Open the panel' }));

describe('the employee panel at /admin', () => {
  it('asks for the password first, and loads no data until it is entered', async () => {
    getState.mockResolvedValue({ configured: true, unlocked: false }); show();
    await screen.findByLabelText(/Password/);
    expect(screen.getByRole('heading', { name: /Employee panel/ })).toBeTruthy();
    expect(getData).not.toHaveBeenCalled();
    expect(screen.queryByText('Alex Rivera')).toBeNull();
  });

  it('keeps the field masked', async () => {
    getState.mockResolvedValue({ configured: true, unlocked: false }); show();
    expect((await screen.findByLabelText(/Password/) as HTMLInputElement).type).toBe('password');
  });

  it('says so, and cannot be used, when the password has not been set up', async () => {
    getState.mockResolvedValue({ configured: false, unlocked: false }); show();
    await screen.findByText(/not set up yet/);
    type('whatever');
    expect((screen.getByRole('button', { name: 'Open the panel' }) as HTMLButtonElement).disabled).toBe(true);
    expect(unlock).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with a clear message and shows nothing', async () => {
    getState.mockResolvedValue({ configured: true, unlocked: false }); unlock.mockResolvedValue({ ok: false, reason: 'wrong' }); show();
    await screen.findByLabelText(/Password/); type('nope'); submit();
    await screen.findByText("That password isn't right.");
    expect(unlock).toHaveBeenCalledWith({ data: { password: 'nope' } });
    expect((screen.getByLabelText(/Password/) as HTMLInputElement).value).toBe('');
    expect(getData).not.toHaveBeenCalled();
  });

  it('tells someone who guessed too often to wait', async () => {
    getState.mockResolvedValue({ configured: true, unlocked: false }); unlock.mockResolvedValue({ ok: false, reason: 'locked', retryAfterSeconds: 600 }); show();
    await screen.findByLabelText(/Password/); type('x'); submit();
    await screen.findByText(/Too many wrong attempts\. Try again in 10 minutes/);
  });

  it('opens the staff view after the right password', async () => {
    getState.mockResolvedValueOnce({ configured: true, unlocked: false }).mockResolvedValue({ configured: true, unlocked: true });
    unlock.mockResolvedValue({ ok: true }); getData.mockResolvedValue(view); show();
    await screen.findByLabelText(/Password/); type('right'); submit();
    await screen.findByRole('region', { name: 'All balances' });
    expect(screen.getByRole('region', { name: 'All transactions' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Settled orders' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'All balances' })).getByText('Alex Rivera')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'All balances' })).getByText('$1,000.00')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Settled orders' })).getByText(/success · \$270\.00 returned/)).toBeTruthy();
  });

  it('has nothing that approves, declines or edits: no such buttons and no inputs at all', async () => {
    getState.mockResolvedValue({ configured: true, unlocked: true }); getData.mockResolvedValue(view); show();
    await screen.findByRole('region', { name: 'All balances' });
    const names = screen.getAllByRole('button').map(b => b.textContent ?? '');
    expect(names.join(' | ')).not.toMatch(/approve|decline|success|fail|save|delete|add transaction|change icon|settle/i);
    expect(screen.queryAllByRole('textbox').length).toBe(0);
    expect(screen.queryAllByRole('spinbutton').length).toBe(0);
    expect(screen.queryByText(/Pending orders/)).toBeNull();
    expect(screen.queryByText('New transaction')).toBeNull();
    expect(screen.getByText(/reserved for the manager/)).toBeTruthy();
  });

  it('locks again when asked, and returns to the password screen', async () => {
    getState.mockResolvedValueOnce({ configured: true, unlocked: true }).mockResolvedValue({ configured: true, unlocked: false });
    getData.mockResolvedValue(view); lock.mockResolvedValue({ ok: true }); show();
    await screen.findByRole('region', { name: 'All balances' });
    fireEvent.click(screen.getByRole('button', { name: /Lock/ }));
    await screen.findByLabelText(/Password/);
    expect(lock).toHaveBeenCalled();
    expect(screen.queryByText('Alex Rivera')).toBeNull();
  });

  it('goes back to the password screen if the session runs out while open', async () => {
    getState.mockResolvedValueOnce({ configured: true, unlocked: true }).mockResolvedValue({ configured: true, unlocked: false });
    getData.mockRejectedValue(new Error('Locked')); show();
    await screen.findByLabelText(/Password/);
    await waitFor(() => expect(screen.queryByText('Alex Rivera')).toBeNull());
  });

  it('shows a clear message and a retry when the data cannot be loaded, instead of loading forever', async () => {
    getState.mockResolvedValue({ configured: true, unlocked: true }); getData.mockRejectedValueOnce(new Error('Data unavailable')).mockResolvedValue(view); show();
    await screen.findByText(/couldn't load/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('region', { name: 'All balances' });
  });
});
