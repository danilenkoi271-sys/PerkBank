export type Profile = { full_name: string; tag: string };
export type Account = { id: string; balance: number };
export type Txn = {
  id: string; title: string; category: string; amount: number;
  note: string | null; reference: string; created_at: string; icon: string | null;
  counterparty?: string | null; transfer_id?: string | null;
};
export type CardDetails = { number: string; expiry: string; cvc: string; name: string };
