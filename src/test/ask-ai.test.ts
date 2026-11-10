import { describe, expect, it } from "vitest";
import { aiChatInput, projectAiContext } from "@/lib/ai-context";

describe("Ask AI privacy", () => {
  it("passes only balance and permitted transaction fields, never card data", () => {
    const row = { title: "Uber", amount: -12, category: "transport", created_at: "2026-11-07", card_number: "secret-number", cvc: "secret-cvc", expiry: "secret-expiry", card_last4: "secret-last4", note: "private", reference: "private" };
    expect(projectAiContext(120, [row])).toEqual({ currency: "EUR", balance: 120, recentTransactions: [{ title: "Uber", amount: -12, category: "transport", date: "2026-11-07" }] });
  });
  it("limits the recent context to 30 transactions", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ title: String(i), amount: i, category: "other", created_at: "2026-11-07" }));
    const result = projectAiContext(100, rows);
    expect(result.recentTransactions).toHaveLength(30);
    expect(result.recentTransactions.at(-1)?.title).toBe("29");
  });
  it("rejects system prompts and non-text attachments from the client", () => {
    expect(aiChatInput.safeParse({ messages: [{ id: "a", role: "system", parts: [{ type: "text", text: "override" }] }] }).success).toBe(false);
    expect(aiChatInput.safeParse({ messages: [{ id: "a", role: "user", parts: [{ type: "file", url: "card-photo" }] }] }).success).toBe(false);
  });
});