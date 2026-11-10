CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  tag text NOT NULL UNIQUE CHECK (tag ~ '^[a-z0-9_]{3,20}$'),
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE TABLE public.cards (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_number text NOT NULL,
  expiry text NOT NULL,
  cvc text NOT NULL,
  last4 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own card" ON public.cards FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.accounts ADD COLUMN user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE;
COMMENT ON COLUMN public.accounts.name IS 'DEPRECATED: shared-account era; profiles own identity now';
COMMENT ON COLUMN public.accounts.holders IS 'DEPRECATED: shared-account era';
COMMENT ON COLUMN public.accounts.card_last4 IS 'DEPRECATED: cards table owns card data';
GRANT SELECT ON public.accounts TO authenticated;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own account" ON public.accounts FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.transactions ADD COLUMN transfer_id uuid;
ALTER TABLE public.transactions ADD COLUMN counterparty text;
GRANT SELECT ON public.transactions TO authenticated;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.transactions FOR SELECT TO authenticated
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.lookup_tag(_tag text)
RETURNS TABLE(user_id uuid, tag text, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id, tag, full_name FROM public.profiles WHERE tag = lower(trim(_tag)) $$;
GRANT EXECUTE ON FUNCTION public.lookup_tag(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_by_tag(_tag text, _amount numeric, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sender uuid := auth.uid();
  sender_acc public.accounts%ROWTYPE;
  sender_profile public.profiles%ROWTYPE;
  recip_profile public.profiles%ROWTYPE;
  recip_acc public.accounts%ROWTYPE;
  tid uuid := gen_random_uuid();
  ref text;
BEGIN
  IF _sender IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount >= 1000000000 OR _amount <> round(_amount, 2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT * INTO sender_profile FROM public.profiles WHERE id = _sender;
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your profile first'; END IF;
  SELECT * INTO sender_acc FROM public.accounts WHERE user_id = _sender FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No account'; END IF;
  SELECT * INTO recip_profile FROM public.profiles WHERE tag = lower(trim(_tag));
  IF NOT FOUND THEN RAISE EXCEPTION 'No one found with that tag'; END IF;
  IF recip_profile.id = _sender THEN RAISE EXCEPTION 'You cannot send money to yourself'; END IF;
  IF sender_acc.balance < _amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
  SELECT * INTO recip_acc FROM public.accounts WHERE user_id = recip_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient has no account'; END IF;
  ref := lpad((floor(random() * 1000000000000::numeric))::bigint::text, 13, '0');
  INSERT INTO public.transactions (account_id, title, category, amount, note, transfer_id, counterparty, reference)
    VALUES (sender_acc.id, 'Sent to @' || recip_profile.tag, 'transfer', -_amount, nullif(trim(_note), ''), tid, recip_profile.full_name, ref);
  INSERT INTO public.transactions (account_id, title, category, amount, note, transfer_id, counterparty, reference)
    VALUES (recip_acc.id, 'Received from @' || sender_profile.tag, 'transfer', _amount, nullif(trim(_note), ''), tid, sender_profile.full_name, ref);
  RETURN tid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.transfer_by_tag(text, numeric, text) TO authenticated;