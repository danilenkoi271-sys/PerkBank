# League name privacy: database change for Lovable

The Private / Public toggle on the League is fully built in the app. It needs one new column, which has to be added
through Lovable (the project rules say not to edit `supabase/migrations/` or `drizzle/` by hand).

Until it is applied the League works exactly as before (every name censored) and the toggle shows "Name privacy
settings are coming soon." and is switched off. Nothing breaks and nobody is exposed.

## What to paste into Lovable

> Please add one column to `profiles`: `public_name boolean not null default false`. It records whether the member
> chose to show their full name on the league. Everyone must start private (`false`), including all existing
> members. Do not change any policies or any other behaviour, and regenerate the Supabase types.

## SQL

```sql
alter table public.profiles add column public_name boolean not null default false;
comment on column public.profiles.public_name is
  'True when the member chose to show their full name on the league. Default false (censored).';
```

## Why nothing else is needed

- The setting is only ever written by an authenticated, PIN-unlocked server function, and only to the signed-in
  member's own row, so no policy change is required and members still cannot edit their own profile directly.
- The league is built on the server. A member's real name is only sent to the browser when `public_name` is true.
  Otherwise the server sends the censored name, so the real name never reaches other members' devices.

## How to check it after it is applied

1. Open the League. The toggle shows **Private** and says how others see you (for example `J•••• M••••`).
2. Switch to **Public** and confirm. The League now shows your full name to everyone, including on other accounts.
3. Switch back to **Private**. The name is censored again straight away, with no question asked.
4. Existing members who never touched it stay private.
