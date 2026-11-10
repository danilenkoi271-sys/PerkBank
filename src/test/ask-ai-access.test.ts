import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  modelCall: vi.fn(),
}));
vi.mock("@/lib/auth.server", () => ({
  getAccountSession: mocks.getSession,
}));
vi.mock("@/lib/ai/responses.server", () => ({ createResponsesCall: mocks.modelCall }));
import { handleAskAi } from "@/lib/ask-ai.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: {}, update: vi.fn() });
});

it("rejects a locked account before contacting AI", async () => {
  const response = await handleAskAi(new Request("http://localhost:8080/api/ask-ai", { method: "POST" }));
  expect(response.status).toBe(401);
  expect(mocks.modelCall).not.toHaveBeenCalled();
});

it("rejects another site's request before account access", async () => {
  const response = await handleAskAi(new Request("http://localhost:8080/api/ask-ai", {
    method: "POST", headers: { origin: "https://other-site.example" },
  }));
  expect(response.status).toBe(403);
  expect(mocks.getSession).not.toHaveBeenCalled();
  expect(mocks.modelCall).not.toHaveBeenCalled();
});