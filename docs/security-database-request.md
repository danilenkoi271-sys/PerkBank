# Security hardening: database change for Lovable

The app already contains everything on its side (it feature-detects these functions, so nothing breaks before they exist
and nothing needs changing after). The database has to be changed through Lovable, because the project rules say not to
edit `supabase/migrations/` or `drizzle/` by hand.

## Why

The PIN and the "one trade at a time" rule are enforced by the app's server functions. But `transfer_by_iban`,
`place_demo_trade`, `purchase_perk` and `update_profile_photo` can also be called **directly** by anyone holding a
member's sign-in token (for example from a stolen browser session), which skips the PIN completely. The fix is to let
only the server call money functions, after it has checked the PIN.

## What to paste into Lovable

> Please apply the SQL below exactly as written and regenerate the Supabase types. Do not change any other behaviour.
> 1. Add server-only versions of the four member functions (they take the user id explicitly and only `service_role`
>    may run them), then remove the members' direct access to the originals.
> 2. Add an atomic PIN-attempt guard (`pin_guard`), so wrong PINs are limited across all server instances.
> 3. Stop members' tokens from reading `profiles.pin_hash` and `profiles.tag` directly (column privileges).
> 4. Make the `profile-photos` bucket private with a 2 MB limit and image types only.
> 5. Remove the unused legacy `cards` table (it once held card numbers and CVCs).
> If a column in the `grant select (...)` list does not exist (for example `public_name`), leave that column out.

## SQL

```sql
-- 1) Server-only money functions ------------------------------------------------------------------------------------
create or replace function public.place_demo_trade_for(_uid uuid, _amount numeric, _multiplier numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.accounts%rowtype; oid uuid;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if _amount is null or _amount <= 0 or _amount >= 1000000000 or _amount <> round(_amount, 2) then raise exception 'Invalid amount'; end if;
  if _multiplier is null or _multiplier < 1.1 or _multiplier > public.perk_max_multiplier(_uid) or _multiplier <> round(_multiplier, 1) then
    raise exception 'Invalid multiplier';
  end if;
  select * into a from public.accounts where user_id = _uid for update;
  if not found or a.balance < _amount then raise exception 'Insufficient funds'; end if;
  insert into public.trade_orders (user_id, account_id, amount, multiplier) values (_uid, a.id, _amount, _multiplier) returning id into oid;
  insert into public.transactions (account_id, title, category, amount, order_id) values (a.id, 'Bot trade · ' || _multiplier || '×', 'investment', -_amount, oid);
  return oid;
end $$;

create or replace function public.transfer_by_iban_for(_uid uuid, _iban text, _amount numeric, _note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare sender public.accounts%rowtype; recipient public.accounts%rowtype; rid uuid; sid text; tid uuid := gen_random_uuid();
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if _amount is null or _amount <= 0 or _amount >= 1000000000 or _amount <> round(_amount, 2) then raise exception 'Invalid amount'; end if;
  if _note is not null and length(_note) > 200 then raise exception 'Note is too long'; end if;
  select id into rid from public.profiles where iban = _iban;
  if rid is null then raise exception 'Account not found'; end if;
  if rid = _uid then raise exception 'Cannot transfer to yourself'; end if;
  perform id from public.accounts where user_id in (_uid, rid) order by id for update;
  select * into sender from public.accounts where user_id = _uid;
  select * into recipient from public.accounts where user_id = rid;
  if sender.id is null or recipient.id is null then raise exception 'Account not found'; end if;
  if sender.balance < _amount then raise exception 'Insufficient funds'; end if;
  select iban into sid from public.profiles where id = _uid;
  insert into public.transactions (account_id, title, category, amount, note, transfer_id, counterparty)
    values (sender.id, 'Sent to ' || _iban, 'transfer', -_amount, _note, tid, _iban),
           (recipient.id, 'Received from ' || sid, 'transfer', _amount, _note, tid, sid);
  return tid;
end $$;

create or replace function public.purchase_perk_for(_uid uuid, _perk_id text, _iban text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := _uid; p public.perk_catalog%rowtype; acct public.accounts%rowtype;
  earned bigint; spent bigint; pid uuid; old_iban text; meta jsonb := '{}'::jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into p from public.perk_catalog where id = _perk_id and active;
  if not found then raise exception 'Perk not available'; end if;
  select * into acct from public.accounts where user_id = uid for update;
  if not found then raise exception 'No account'; end if;
  select coalesce(sum(floor(amount * 10)), 0) into earned from public.trade_orders where user_id = uid;
  select coalesce(sum(cost), 0) into spent from public.perk_purchases where user_id = uid;
  if earned - spent < p.cost then raise exception 'Not enough points'; end if;
  if not p.repeatable and exists (select 1 from public.perk_purchases where user_id = uid and perk_id = p.id) then
    raise exception 'You already own this perk';
  end if;
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
  insert into public.perk_purchases (user_id, perk_id, cost, meta) values (uid, p.id, p.cost, meta) returning id into pid;
  return pid;
end $$;

create or replace function public.update_profile_photo_for(_uid uuid, _path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if _path !~ ('^' || _uid::text || '/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$') then raise exception 'Invalid photo path'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'profile-photos' and name = _path) then raise exception 'Photo not found'; end if;
  update public.profiles set avatar_url = 'perk-photo:' || _path where id = _uid;
  if not found then raise exception 'Profile not found'; end if;
end $$;

revoke all on function public.place_demo_trade_for(uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.transfer_by_iban_for(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.purchase_perk_for(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_profile_photo_for(uuid, text) from public, anon, authenticated;
grant execute on function public.place_demo_trade_for(uuid, numeric, numeric) to service_role;
grant execute on function public.transfer_by_iban_for(uuid, text, numeric, text) to service_role;
grant execute on function public.purchase_perk_for(uuid, text, text) to service_role;
grant execute on function public.update_profile_photo_for(uuid, text) to service_role;

-- The originals are no longer callable with a member's token. The app now uses the server-only versions above.
revoke execute on function public.place_demo_trade(numeric, numeric) from authenticated;
revoke execute on function public.transfer_by_iban(text, numeric, text) from authenticated;
revoke execute on function public.purchase_perk(text, text) from authenticated;
revoke execute on function public.update_profile_photo(text) from authenticated;

-- 2) Atomic PIN-attempt guard: 5 guesses per 15 minutes, then a 15 minute lock --------------------------------------
create table public.pin_guard (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  fails integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.pin_guard enable row level security;
revoke all on public.pin_guard from anon, authenticated;
grant all on public.pin_guard to service_role;

-- Called BEFORE the PIN is checked: it counts the attempt first, so parallel guesses cannot all get through.
-- Returns 0 when the attempt may go ahead, otherwise the seconds left on the lock.
create or replace function public.pin_guard_begin(_uid uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare g public.pin_guard%rowtype;
begin
  insert into public.pin_guard (user_id) values (_uid) on conflict (user_id) do nothing;
  select * into g from public.pin_guard where user_id = _uid for update;
  if g.locked_until is not null and g.locked_until > now() then
    return greatest(1, ceil(extract(epoch from (g.locked_until - now())))::integer);
  end if;
  if g.locked_until is not null or g.window_start < now() - interval '15 minutes' then
    g.fails := 0; g.window_start := now(); g.locked_until := null;
  end if;
  g.fails := g.fails + 1;
  if g.fails > 5 then
    update public.pin_guard set fails = g.fails, window_start = g.window_start, locked_until = now() + interval '15 minutes' where user_id = _uid;
    return 900;
  end if;
  update public.pin_guard set fails = g.fails, window_start = g.window_start, locked_until = null where user_id = _uid;
  return 0;
end $$;

create or replace function public.pin_guard_ok(_uid uuid) returns void
language sql security definer set search_path = public as $$
  update public.pin_guard set fails = 0, window_start = now(), locked_until = null where user_id = _uid
$$;

revoke all on function public.pin_guard_begin(uuid), public.pin_guard_ok(uuid) from public, anon, authenticated;
grant execute on function public.pin_guard_begin(uuid), public.pin_guard_ok(uuid) to service_role;

-- 3) Members' tokens must not read pin_hash or the legacy tag ------------------------------------------------------
-- (the app reads the PIN hash with the server's own access). Leave out any column that does not exist.
revoke select on public.profiles from authenticated;
grant select (id, full_name, iban, avatar_url, public_name, created_at) on public.profiles to authenticated;

-- 4) Photos: private, small, images only ---------------------------------------------------------------------------
update storage.buckets
   set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'profile-photos';

-- 5) Legacy card table (card numbers and CVCs from an earlier version) ---------------------------------------------
drop table if exists public.cards;
```

## How to check it after it is applied

1. Send money, place a trade, buy a perk and change a profile photo in the app. All must work as before.
2. With a signed-in member's token, calling `rpc/transfer_by_iban` or `rpc/place_demo_trade` directly must now answer
   `permission denied`.
3. Enter a wrong PIN six times: the sixth answer is "Too many tries. Wait 15 min." and the correct PIN is also refused
   until the lock ends.
4. Reading `profiles?select=pin_hash` with a member's token must be refused.

## Already checked on the live backend (read only, without signing in)

- Email, phone and anonymous sign-up are all switched off; only Google sign-in is on, so nobody can pre-register an
  account under someone else's email.
- Without signing in, `profiles`, `trade_orders` and `user_roles` return no rows, `accounts` and `transactions` are
  refused, and every money, role and perk function answers `permission denied`.
