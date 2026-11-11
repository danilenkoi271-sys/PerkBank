import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Receipt } from '@/components/perk/Receipt';
import type { Txn } from '@/lib/bank';
import { settleDuration } from '@/lib/live-trade';

afterEach(cleanup);
const done = new Date(Date.now() - 6 * 3600_000).toISOString();
const placed = new Date(Date.now() - 7 * 3600_000).toISOString();
const order = (status: string) => ({ id: 'rc-' + status, amount: 150, multiplier: 1.8, status, created_at: placed, settled_at: done });
const txn = (category: string, amount: number): Txn => ({ id: 't', title: category === 'investment' ? 'Bot trade · 1.8×' : 'Bot trade won · 1.8×', category, amount, note: null, reference: 'PK0000048219', created_at: placed, icon: null });
const open = (t: Txn, trade: ReturnType<typeof order> | null, anonymous = false) => render(<Receipt txn={t} iban="48217" holder="Alex Rivera" anonymous={anonymous} trade={trade} onClose={() => {}}/>);

describe('the chart on a trade receipt', () => {
  it('appears on the stake receipt and on the payout receipt of the same trade', () => {
    open(txn('investment', -150), order('success'));
    expect(screen.getByRole('group', { name: 'Trade chart' })).toBeTruthy();
    cleanup();
    open(txn('investment_payout', 270), order('success'));
    expect(screen.getByRole('group', { name: 'Trade chart' })).toBeTruthy();
  });
  it('says how a finished win ended, and shows the times it ran', () => {
    open(txn('investment_payout', 270), order('success'));
    const chart = screen.getByRole('group', { name: 'Trade chart' });
    expect(within(chart).getByText('+80.0%')).toBeTruthy();
    expect(within(chart).getByRole('img', { name: /ending up 80\.0 percent/ })).toBeTruthy();
    expect(chart.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
  it('shows a loss ending down', () => {
    open(txn('investment', -150), order('failed'));
    const chart = screen.getByRole('group', { name: 'Trade chart' });
    expect(within(chart).getByText('−100.0%')).toBeTruthy();
  });
  it('also appears on anonymous receipts, which still show no holder or IBAN', () => {
    open(txn('investment', -150), order('success'), true);
    expect(screen.getByRole('group', { name: 'Trade chart' })).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).not.toMatch(/IBAN|Alex Rivera/);
  });
  it('is left out of receipts that are not for a trade', () => {
    open({ ...txn('transfer', -45), title: 'Jordan M.' }, null);
    expect(screen.queryByRole('group', { name: 'Trade chart' })).toBeNull();
  });
  it('shows no ending for a trade that is still playing out', () => {
    const o = { ...order('success'), settled_at: new Date(Date.now() - settleDuration({ id: '', amount: 0, multiplier: 0, status: 'success' }) / 2).toISOString(), created_at: new Date(Date.now() - 3600_000).toISOString() };
    open(txn('investment', -150), o);
    expect(within(screen.getByRole('group', { name: 'Trade chart' })).getByText('In progress')).toBeTruthy();
  });
});
