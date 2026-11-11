# Employee panel (`/admin`)

A read-only staff view of the bank. Anyone can open `/admin` (signed in or not); it shows a password screen first.

## One setup step: add the password as a Lovable Secret

Add a secret named `EMPLOYEE_PANEL_PASSWORD` in Lovable (Secrets) with the staff password. The password is never stored in the
repo. Until the secret exists, the panel shows "The employee panel is not set up yet" and nobody can get in.
`SESSION_SECRET` (already used by the app) signs the unlock cookie.

## What it shows

All balances, all transactions (with the owner), and settled orders. It deliberately has no pending-orders section and no
approve/decline, balance or transaction editing: that stays in the manager panel.
Trades whose chart is still playing are hidden, and balances exclude their held winnings, so staff never see a result early.

## Behaviour and limits

- The password is checked on the server with a constant-time comparison; the browser never receives it.
- Unlocking lasts 8 hours (httpOnly cookie) and every data request re-checks it. "Lock" ends it at once.
- 5 wrong attempts lock that visitor out for 15 minutes. This limiter is in memory per server instance, so treat it as
  best-effort, not a guarantee.
- A single shared password is weak protection for a page that lists every member's name, IBAN and balance. Use a long,
  random password and rotate it by changing the secret.
