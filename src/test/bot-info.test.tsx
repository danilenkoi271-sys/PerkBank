import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotInfo } from '@/components/perk/BotInfo';
import type { FeedTrade } from '@/lib/trade-feed';

const { feed } = vi.hoisted(() => ({ feed: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/investing.functions', () => ({ getTradeFeed: feed }));
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const trades: FeedTrade[] = [
  { id: 'a', amount: 150, multiplier: 1.8, status: 'success', payout: 270, placedAt: new Date(Date.now() - 600_000).toISOString(), settledAt: new Date(Date.now() - 100_000).toISOString(), stake: { reference: 'PK0000048218', title: 'Bot trade · 1.8×', amount: -150, createdAt: new Date(Date.now() - 600_000).toISOString() }, payoutReceipt: { reference: 'PK0000048219', title: 'Bot trade won · 1.8×', amount: 270, createdAt: new Date(Date.now() - 100_000).toISOString() } },
  { id: 'b', amount: 80, multiplier: 2.4, status: 'failed', payout: 0, placedAt: new Date(Date.now() - 900_000).toISOString(), settledAt: new Date(Date.now() - 200_000).toISOString(), stake: { reference: 'PK0000048200', title: 'Bot trade · 2.4×', amount: -80, createdAt: new Date(Date.now() - 900_000).toISOString() }, payoutReceipt: null },
  { id: 'c', amount: 40, multiplier: 1.5, status: 'pending', payout: 0, placedAt: new Date(Date.now() - 20_000).toISOString(), settledAt: null, stake: null, payoutReceipt: null },
];
const show = (props: Partial<{ open: boolean; max: number }> = {}) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BotInfo open={props.open ?? true} onClose={vi.fn()} maxMultiplier={props.max ?? 3}/></QueryClientProvider>);

describe('the trading bot info panel', () => {
  it('describes the bot: SOL, long only, and the target range', async () => {
    feed.mockResolvedValue(trades); show();
    expect(screen.getByRole('dialog', { name: 'About the trading bot' })).toBeTruthy();
    expect(screen.getByText('SOL')).toBeTruthy();
    expect(screen.getByText('Long only')).toBeTruthy();
    expect(screen.getByText('1.1× to 3.0×')).toBeTruthy();
    await screen.findByLabelText('Live trades');
  });
  it('is honest that trading is simulated and does not claim a third-party service runs it', async () => {
    feed.mockResolvedValue(trades); const { container } = show();
    expect(screen.getByText(/simulated/i)).toBeTruthy();
    expect(screen.getByText(/set by the site administrator/i)).toBeTruthy();
    expect(container.ownerDocument.body.textContent).not.toMatch(/pumpportal/i);
    await screen.findByLabelText('Live trades');
  });
  it('reflects the max-target perk in the range', async () => {
    feed.mockResolvedValue([]); show({ max: 4 });
    expect(screen.getByText('1.1× to 4.0×')).toBeTruthy();
    await screen.findByText(/No trades yet/);
  });
  it('lists everyone’s trades live with amounts, results and times, and no names', async () => {
    feed.mockResolvedValue(trades); show();
    const list = await screen.findByLabelText('Live trades');
    const rows = within(list).getAllByRole('listitem');
    expect(rows.length).toBe(3);
    expect(within(rows[0] as HTMLElement).getByText('+$120.00')).toBeTruthy(); // profit on the win
    expect(within(rows[1] as HTMLElement).getByText('−$80.00')).toBeTruthy(); // the stake lost
    expect(within(rows[2] as HTMLElement).getByText('Live')).toBeTruthy();
    expect(list.textContent).toMatch(/\d{2}:\d{2}:\d{2}/); // a time on every trade
  });
  it('opens a receipt for a trade that carries no account holder or IBAN', async () => {
    feed.mockResolvedValue(trades); show();
    await screen.findByLabelText('Live trades');
    fireEvent.click(screen.getByRole('button', { name: /Payout receipt/ }));
    const receipt = await screen.findByRole('dialog', { name: 'Transaction receipt' });
    expect(within(receipt).getAllByText('PK0000048219').length).toBeGreaterThan(0);
    expect(receipt.textContent).not.toMatch(/IBAN/);
  });
  it('says so when live trades cannot be loaded', async () => {
    feed.mockRejectedValue(new Error('boom')); show();
    await screen.findByText(/unavailable right now/);
  });
  it('renders nothing and loads nothing while closed', () => {
    feed.mockResolvedValue(trades); show({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(feed).not.toHaveBeenCalled();
  });
});
