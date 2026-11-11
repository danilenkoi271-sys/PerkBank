import { describe, expect, it } from 'vitest';
import { buildEmployeeView, createAttemptLimiter, panelPasswordInput, passwordMatches } from '@/lib/employee-panel';
import { SETTLE_FAIL_MS, SETTLE_SUCCESS_MS } from '@/lib/live-trade';

describe('the staff password check', () => {
  it('accepts exactly the right password', async () => { expect(await passwordMatches('Correct-Horse-9!', 'Correct-Horse-9!')).toBe(true); });
  it('rejects anything else, including near misses and different lengths', async () => {
    for (const guess of ['correct-horse-9!', 'Correct-Horse-9', 'Correct-Horse-9!!', '', ' Correct-Horse-9!', 'x']) expect(await passwordMatches(guess, 'Correct-Horse-9!')).toBe(false);
  });
  it('never matches when no password has been set up, not even an empty guess', async () => {
    expect(await passwordMatches('', undefined)).toBe(false);
    expect(await passwordMatches('anything', undefined)).toBe(false);
    expect(await passwordMatches('', '')).toBe(false);
  });
  it('only takes a non-empty, bounded password in the request', () => {
    expect(panelPasswordInput.safeParse({ password: 'x' }).success).toBe(true);
    expect(panelPasswordInput.safeParse({ password: '' }).success).toBe(false);
    expect(panelPasswordInput.safeParse({ password: 'x'.repeat(201) }).success).toBe(false);
    expect(panelPasswordInput.safeParse({}).success).toBe(false);
  });
});

describe('guess limiting', () => {
  const T = 1_000_000;
  it('locks a place out after five wrong guesses, and says for how long', () => {
    const l = createAttemptLimiter();
    for (let i = 0; i < 4; i++) { l.fail('ip', T + i); expect(l.check('ip', T + i).allowed).toBe(true); }
    l.fail('ip', T + 5);
    const gate = l.check('ip', T + 6);
    expect(gate.allowed).toBe(false);
    expect(gate.retryAfterMs).toBeGreaterThan(14 * 60_000);
  });
  it('lets them try again once the lock has passed', () => {
    const l = createAttemptLimiter({ max: 3, lockMs: 60_000 });
    for (let i = 0; i < 3; i++) l.fail('ip', T);
    expect(l.check('ip', T + 59_000).allowed).toBe(false);
    expect(l.check('ip', T + 61_000).allowed).toBe(true);
  });
  it('keeps different places separate', () => {
    const l = createAttemptLimiter({ max: 2 });
    l.fail('a', T); l.fail('a', T);
    expect(l.check('a', T + 1).allowed).toBe(false);
    expect(l.check('b', T + 1).allowed).toBe(true);
  });
  it('forgets old mistakes after the window, and a correct entry clears the count', () => {
    const l = createAttemptLimiter({ max: 3, windowMs: 60_000 });
    l.fail('ip', T); l.fail('ip', T + 10);
    l.fail('ip', T + 120_000); // the old two are outside the window
    expect(l.check('ip', T + 120_001).allowed).toBe(true);
    const m = createAttemptLimiter({ max: 3 });
    m.fail('ip', T); m.fail('ip', T); m.succeed('ip'); m.fail('ip', T);
    expect(m.check('ip', T + 1).allowed).toBe(true);
  });
});

describe('what an employee can see', () => {
  const NOW = Date.parse('2026-11-10T22:00:00.000Z');
  const ago = (ms: number) => new Date(NOW - ms).toISOString();
  const profiles = [{ id: 'u1', full_name: 'Alex Rivera', iban: '48217' }, { id: 'u2', full_name: 'Jordan Miles', iban: '48210' }];
  const accounts = [{ id: 'acc1', user_id: 'u1', balance: 1000 }, { id: 'acc2', user_id: 'u2', balance: 500 }];
  const order = (o: Partial<Parameters<typeof buildEmployeeView>[0]['orders'][number]> & { id: string; user_id: string }) => ({ amount: 100, multiplier: 2, status: 'pending', payout: 0, created_at: ago(900_000), settled_at: null, ...o });
  const txn = (id: string, account_id: string, category: string, order_id: string | null = null, amount = -100) => ({ id, account_id, title: category, category, amount, note: null, reference: 'PK' + id, created_at: ago(60_000), icon: null, order_id });
  const view = (orders: ReturnType<typeof order>[], txns = [txn('t1', 'acc1', 'investment', 'o1')]) => buildEmployeeView({ profiles, accounts, txns, orders, now: NOW });

  it('leaves out every trade that is waiting for the manager’s decision', () => {
    const v = view([order({ id: 'o1', user_id: 'u1' }), order({ id: 'o2', user_id: 'u2', status: 'success', payout: 200, settled_at: ago(SETTLE_SUCCESS_MS + 5_000) })]);
    expect(v.orders.map(o => o.id)).toEqual(['o2']);
    expect(JSON.stringify(v)).not.toContain('pending');
  });
  it('also hides a settled trade whose chart is still playing, so it still counts as live', () => {
    const live = order({ id: 'o1', user_id: 'u1', status: 'success', payout: 200, settled_at: ago(10_000) });
    const v = view([live], [txn('t1', 'acc1', 'investment', 'o1'), txn('t2', 'acc1', 'investment_payout', 'o1', 200)]);
    expect(v.orders).toEqual([]);
    expect(v.txns.map(t => t.id)).toEqual(['t1']); // the payout entry waits too
    expect(v.users.find(u => u.id === 'u1')?.balance).toBe(800); // 1000 minus the 200 not yet revealed
  });
  it('shows finished trades, wins and losses, with their results', () => {
    const v = view([order({ id: 'w', user_id: 'u1', status: 'success', payout: 200, settled_at: ago(SETTLE_SUCCESS_MS + 1_000) }), order({ id: 'l', user_id: 'u2', status: 'failed', settled_at: ago(SETTLE_FAIL_MS + 1_000) })]);
    expect(v.orders.map(o => [o.id, o.status, o.payout])).toEqual([['w', 'success', 200], ['l', 'failed', 0]]);
    expect(v.orders[0]?.owner).toBe('Alex Rivera');
  });
  it('shows every balance and who each transaction belongs to', () => {
    const v = view([], [txn('t1', 'acc1', 'transfer'), txn('t2', 'acc2', 'transfer'), txn('t3', 'acc-gone', 'transfer')]);
    expect(v.users.map(u => [u.full_name, u.iban, u.balance])).toEqual([['Alex Rivera', '48217', 1000], ['Jordan Miles', '48210', 500]]);
    expect(v.txns.map(t => t.owner)).toEqual(['Alex Rivera', 'Jordan Miles', 'Legacy account']);
  });
  it('never carries account ids, user ids on transactions or any approval control data', () => {
    const v = view([order({ id: 'w', user_id: 'u1', status: 'success', payout: 200, settled_at: ago(SETTLE_SUCCESS_MS + 1_000) })]);
    const text = JSON.stringify(v);
    expect(text).not.toContain('acc1'); expect(text).not.toContain('acc2');
    expect(Object.keys(v.txns[0] ?? {}).sort()).toEqual(['amount', 'category', 'created_at', 'icon', 'id', 'note', 'owner', 'reference', 'title']);
    expect(Object.keys(v.orders[0] ?? {}).sort()).toEqual(['amount', 'created_at', 'id', 'multiplier', 'owner', 'payout', 'settled_at', 'status']);
  });
});
