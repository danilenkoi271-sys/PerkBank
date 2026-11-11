# Perks: database change for Lovable

The Perks shop (points, custom IBAN, 4× max target) is fully built in the app. It needs this database change, which
has to be applied through Lovable (the project rules say not to edit `supabase/migrations/` or `drizzle/` by hand).
Until it is applied, the Perks tab shows "Perks are on the way" and nothing else in the app is affected.

## What to paste into Lovable

> Please add a perks system to the database, exactly as specified below, and regenerate the Supabase types.
> Do not change any other behaviour. Everything must be atomic and enforced in the database, the same way trades are.
>
> 1. Two new tables, `perk_catalog` (prices) and `perk_purchases` (what each user bought), with row level security:
>    users can read the catalog and only their own purchases, and nobody can insert, update or delete purchases
>    directly. Purchases are only created by the `purchase_perk` function.
> 2. Perk points are never stored as a counter. Balance = points earned minus points spent, where earned is
>    `floor(amount * 10)` summed over the user's `trade_orders` (every $1 invested earns 10 points, win or lose) and
>    spent is the sum of `perk_purchases.cost`.
> 3. `purchase_perk(_perk_id, _iban)` locks the user's account row first (the same lock `place_demo_trade` takes), checks
>    the points, refuses a one-time perk that is already owned, applies the perk's effect and records the purchase.
> 4. `place_demo_trade` must allow a target up to the user's personal maximum (3.0, or 4.0 after buying `max_target_4x`)
>    instead of the fixed 3.
>
> The SQL is below. Please apply it as is.

## SQL

```sql
-- 1) Catalog (the authoritative prices) and purchases ---------------------------------------------------------------
create table public.perk_catalog (
  id text primary key,
  cost integer not null check (cost > 0),
  repeatable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.perk_catalog (id, cost, repeatable) values
  ('custom_iban', 500, true),
  ('max_target_4x', 1000, false);

create table public.perk_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  perk_id text not null references public.perk_catalog(id),
  cost integer not null check (cost > 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index perk_purchases_user_idx on public.perk_purchases (user_id, created_at desc);

alter table public.perk_catalog enable row level security;
alter table public.perk_purchases enable row level security;
create policy "Anyone signed in can read the catalog" on public.perk_catalog for select to authenticated using (true);
create policy "Users read their own purchases" on public.perk_purchases for select to authenticated using (user_id = auth.uid());
revoke all on public.perk_catalog, public.perk_purchases from anon;
revoke insert, update, delete on public.perk_catalog, public.perk_purchases from authenticated;

-- 2) The user's personal maximum target (internal helper) -----------------------------------------------------------
create or replace function public.perk_max_multiplier(_uid uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.perk_purchases where user_id = _uid and perk_id = 'max_target_4x')
              then 4.0 else 3.0 end
$$;
revoke all on function public.perk_max_multiplier(uuid) from public, anon, authenticated;

-- 3) Points, owned perks and the catalog in one call ----------------------------------------------------------------
create or replace function public.perk_points_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); earned bigint; spent bigint;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select coalesce(sum(floor(amount * 10)), 0) into earned from public.trade_orders where user_id = uid;
  select coalesce(sum(cost), 0) into spent from public.perk_purchases where user_id = uid;
  return jsonb_build_object(
    'earned', earned,
    'spent', spent,
    'balance', earned - spent,
    'owned', (select coalesce(jsonb_object_agg(perk_id, n), '{}'::jsonb)
              from (select perk_id, count(*) as n from public.perk_purchases where user_id = uid group by perk_id) t),
    'catalog', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cost', cost, 'repeatable', repeatable) order by cost), '[]'::jsonb)
                from public.perk_catalog where active),
    'max_multiplier', public.perk_max_multiplier(uid)
  );
end $$;
revoke all on function public.perk_points_state() from public, anon;
grant execute on function public.perk_points_state() to authenticated;

-- 4) Buying a perk (atomic) -----------------------------------------------------------------------------------------
create or replace function public.purchase_perk(_perk_id text, _iban text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p public.perk_catalog%rowtype; acct public.accounts%rowtype;
  earned bigint; spent bigint; pid uuid; old_iban text; meta jsonb := '{}'::jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into p from public.perk_catalog where id = _perk_id and active;
  if not found then raise exception 'Perk not available'; end if;
  -- Same lock a trade takes, so points cannot be earned and spent at the same instant.
  select * into acct from public.accounts where user_id = uid for update;
  if not found then raise exception 'No account'; end if;
  select coalesce(sum(floor(amount * 10)), 0) into earned from public.trade_orders where user_id = uid;
  select coalesce(sum(cost), 0) into spent from public.perk_purchases where user_id = uid;
  if earned - spent < p.cost then raise exception 'Not enough points'; end if;
  if not p.repeatable and exists (select 1 from public.perk_purchases where user_id = uid and perk_id = p.id) then
    raise exception 'You already own this perk';
  end if;

  -- The effect of each perk. Add a branch here when you add a perk.
  if p.id = 'custom_iban' then
    if _iban is null or _iban !~ '^[0-9]{5}$' then raise exception 'Choose a five-digit IBAN'; end if;
    select iban into old_iban from public.profiles where id = uid for update;
    if old_iban = _iban then raise exception 'That is already your IBAN'; end if;
    begin
      update public.profiles set iban = _iban where id = uid;
    exception when unique_violation then
      raise exception 'That IBAN is taken';
    end;
    meta := jsonb_build_object('old_iban', old_iban, 'new_iban', _iban);
  end if;
  -- 'max_target_4x' needs no effect here: owning the purchase is the perk (see perk_max_multiplier).

  insert into public.perk_purchases (user_id, perk_id, cost, meta) values (uid, p.id, p.cost, meta) returning id into pid;
  return pid;
end $$;
revoke all on function public.purchase_perk(text, text) from public, anon;
grant execute on function public.purchase_perk(text, text) to authenticated;

-- 5) Trades: allow up to the user's personal maximum instead of a fixed 3 -------------------------------------------
create or replace function public.place_demo_trade(_amount numeric, _multiplier numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.accounts%rowtype; oid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _amount is null or _amount <= 0 or _amount >= 1000000000 or _amount <> round(_amount, 2) then raise exception 'Invalid amount'; end if;
  if _multiplier is null or _multiplier < 1.1 or _multiplier > public.perk_max_multiplier(auth.uid()) or _multiplier <> round(_multiplier, 1) then
    raise exception 'Invalid multiplier';
  end if;
  select * into a from public.accounts where user_id = auth.uid() for update;
  if not found or a.balance < _amount then raise exception 'Insufficient funds'; end if;
  insert into public.trade_orders (user_id, account_id, amount, multiplier) values (auth.uid(), a.id, _amount, _multiplier) returning id into oid;
  insert into public.transactions (account_id, title, category, amount, order_id) values (a.id, 'Bot trade · ' || _multiplier || '×', 'investment', -_amount, oid);
  return oid;
end $$;
revoke all on function public.place_demo_trade(numeric, numeric) from public, anon;
grant execute on function public.place_demo_trade(numeric, numeric) to authenticated;
```

## How to check it after it is applied

1. Open the Perks tab. You should see your points, `Earned` and `Spent`, and both perks.
2. Points: place a $100 trade and the balance rises by 1,000 (win or lose).
3. Buy "Max target 4×" with 1,000 points. The Invest slider now goes to 4.0× and a 4× trade is accepted. Before the
   purchase a 3.1× trade must be refused by the database.
4. Buy "Custom IBAN" with 500 points. Your IBAN changes everywhere, and a taken IBAN is refused without spending points.
5. Try to buy something with too few points, or the 4× perk twice. Both must be refused.

## How to add a perk later

1. Add a row to `perk_catalog` (id, cost, repeatable).
2. If it has an effect on data, add a branch for it in `purchase_perk`. If it only unlocks something, check for the
   purchase where it matters (like `perk_max_multiplier`).
3. Add its title, description and icon to `PERK_UI` in `src/components/perk/perk-ui.ts`.

Prices, one-time or repeatable, and turning a perk on or off (`active`) are all changed in the catalog table, with no
app deploy.
