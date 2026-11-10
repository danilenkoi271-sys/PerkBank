CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Perk Shared',
  holders text NOT NULL DEFAULT 'Ivan & Friend',
  card_last4 text NOT NULL DEFAULT '4512',
  balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.accounts TO anon, authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view accounts" ON public.accounts FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric(12,2) NOT NULL,
  note text,
  reference text NOT NULL DEFAULT lpad((floor(random()*1e12))::bigint::text, 13, '0'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO anon, authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view transactions" ON public.transactions FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX transactions_account_created_idx ON public.transactions(account_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_transaction_to_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    RETURN NEW;
  ELSE
    UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_transaction_to_balance() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER transactions_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_to_balance();

INSERT INTO public.accounts (id, name, holders, card_last4, balance)
VALUES ('00000000-0000-0000-0000-000000000001', 'Perk Shared', 'Ivan & Friend', '4512', 0);

INSERT INTO public.transactions (account_id, title, category, amount, note, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'Opening deposit', 'deposit', 1500.00, 'Welcome to Perk', now() - interval '6 days'),
('00000000-0000-0000-0000-000000000001', 'Pingo Doce', 'groceries', -42.37, NULL, now() - interval '5 days'),
('00000000-0000-0000-0000-000000000001', 'Uber', 'transport', -12.80, NULL, now() - interval '4 days'),
('00000000-0000-0000-0000-000000000001', 'Time Out Market', 'food', -36.50, 'Dinner', now() - interval '3 days'),
('00000000-0000-0000-0000-000000000001', 'Spotify Duo', 'subscriptions', -14.99, NULL, now() - interval '2 days'),
('00000000-0000-0000-0000-000000000001', 'Cinema NOS', 'entertainment', -19.00, NULL, now() - interval '1 day'),
('00000000-0000-0000-0000-000000000001', 'Top up', 'deposit', 200.00, NULL, now() - interval '3 hours');