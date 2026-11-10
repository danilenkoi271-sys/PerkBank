import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { X, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

function AiRing({ busy }: { busy: boolean }) {
  return <span className="ai-ring" data-busy={busy} aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function AskAi() {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ask-ai", credentials: "same-origin",
      prepareSendMessagesRequest: ({ messages }) => ({ body: { messages: messages.map((message) => ({
        id: message.id, role: message.role,
        parts: message.parts.filter((part) => part.type === "text").map((part) => ({ type: "text", text: part.text })),
      })) } }),
    }),
  });
  const busy = status === "submitted" || status === "streaming";
  const answer = [...messages].reverse().find((message) => message.role === "assistant");
  const hasAnswer = Boolean(answer?.parts.some((part) => part.type === "text" && part.text.trim()));
  useEffect(() => {
    if (expanded && !busy) textarea.current?.focus({ preventScroll: true });
  }, [expanded, busy]);
  useEffect(() => () => { void stop(); }, [stop]);

  return (
    <section className="ask-ai" data-expanded={expanded} aria-label="Ask AI">
        <Button variant="ghost" className="ask-ai-launch" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label="Ask AI">
          <span className="font-display text-sm font-semibold">Ask AI</span>
          <AiRing busy={busy} />
        </Button>
        <div className="ai-expanded-content" inert={!expanded} aria-hidden={!expanded}>
          <div className="ai-answer-reveal" data-visible={hasAnswer || busy || Boolean(error)}>
            <div className="ai-answer-clip">
              <div className="ai-answer" aria-live="polite">
              {hasAnswer && answer && (
                <Message key={answer.id} from="assistant">
                  <MessageContent>
                    {answer.parts.map((part, i) => part.type === "text" ? <MessageResponse key={i}>{part.text}</MessageResponse> : null)}
                  </MessageContent>
                </Message>
              )}
              {busy && !hasAnswer && <Shimmer className="text-sm">Thinking…</Shimmer>}
              {error && <p role="alert" className="text-sm">{error.message}</p>}
              </div>
            </div>
          </div>
          <div className="ai-search">
            <span className="ai-search-ring"><AiRing busy={busy} /></span>
            <PromptInput onSubmit={({ text }) => {
              if (!text.trim() || busy) return;
              clearError();
              void sendMessage({ text: text.trim() });
              setInput("");
              textarea.current?.focus();
            }}>
              <PromptInputTextarea ref={textarea} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Perk anything…" aria-label="Ask AI a question" maxLength={6000} rows={1} className="text-base" />
              <PromptInputFooter>
                <PromptInputSubmit status={status} onStop={() => { void stop(); }} disabled={!busy && !input.trim()} className="size-8 shrink-0">
                  {!busy && <ArrowUp className="size-4" />}
                </PromptInputSubmit>
                <Button type="button" variant="ghost" size="icon-xs" title="Close Ask AI" aria-label="Collapse Ask AI" onClick={() => setExpanded(false)}><X className="size-3.5" /></Button>
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
    </section>
  );
}