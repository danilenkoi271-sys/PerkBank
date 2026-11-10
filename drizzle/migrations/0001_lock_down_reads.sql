DROP POLICY IF EXISTS "Anyone can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Anyone can view transactions" ON public.transactions;
REVOKE SELECT ON public.accounts FROM anon, authenticated;
REVOKE SELECT ON public.transactions FROM anon, authenticated;