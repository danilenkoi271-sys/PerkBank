import { z } from "zod";

export const aiChatInput = z.object({
  messages: z.array(z.object({
    id: z.string().max(100),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string().max(6000) })).max(20),
  })).min(1).max(60),
});

export function projectAiContext(balance: number, transactions: Array<{ title: string; amount: number; category: string; created_at: string }>) {
  return {
    currency: "EUR",
    balance: Number(balance),
    recentTransactions: transactions.slice(0, 30).map((t) => ({
      title: t.title, amount: Number(t.amount), category: t.category, date: t.created_at,
    })),
  };
}