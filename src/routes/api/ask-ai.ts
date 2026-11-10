import { createFileRoute } from "@tanstack/react-router";
import { handleAskAi } from "@/lib/ask-ai.server";

export const Route = createFileRoute("/api/ask-ai")({
  server: { handlers: { POST: ({ request }) => handleAskAi(request) } },
});