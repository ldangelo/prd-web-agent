"use client";

import React, { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./MessageList";
import { StreamingMessage } from "./StreamingMessage";
import { ErrorBanner } from "./ErrorBanner";
import { MessageComposer } from "./MessageComposer";

interface ChatInterfaceProps {
  prdId: string;
  projectId: string;
  userId: string;
  mode?: "create" | "refine";
  onPrdSaved?: (prdId: string, version: number) => void;
}

export function ChatInterface({
  prdId,
  mode = "refine",
  onPrdSaved,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingChunks, setStreamingChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist sessionId across messages for multi-turn conversation
  const sessionIdRef = useRef<string | null>(null);
  // Collect chunks in a ref so finalization doesn't depend on state updaters
  const chunksRef = useRef<string[]>([]);

  const handleSend = useCallback(
    async (text: string, _images?: File[]) => {
      // Add user message to the list immediately
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);
      setIsStreaming(true);
      setStreamingChunks([]);
      chunksRef.current = [];

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prdId,
            text,
            sessionId: sessionIdRef.current,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error ?? `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error("No response body");
        }

        // Parse SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              try {
                const parsed = JSON.parse(data);
                handleSSEEvent(currentEvent, parsed);
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Stream ended — finalize from ref (avoids StrictMode double-invoke)
        const collected = chunksRef.current;
        if (collected.length > 0) {
          const content = collected.join("");
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: "agent",
              content,
              timestamp: new Date(),
            },
          ]);
        }
        setStreamingChunks([]);
        chunksRef.current = [];
      } catch (err: any) {
        setError(err.message ?? "Failed to send message");
      } finally {
        setIsStreaming(false);
      }
    },
    [prdId],
  );

  function handleSSEEvent(event: string, data: any) {
    switch (event) {
      case "session":
        sessionIdRef.current = data.sessionId;
        break;
      case "text_delta":
        chunksRef.current.push(data.delta);
        setStreamingChunks((prev) => [...prev, data.delta]);
        break;
      case "error":
        setError(data.error);
        break;
      case "prd_saved":
        onPrdSaved?.(data.prdId, data.version);
        break;
    }
  }

  const handleRetry = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} />
      <StreamingMessage chunks={streamingChunks} isStreaming={isStreaming} />
      <ErrorBanner error={error} retryable={!!error} onRetry={handleRetry} />
      <MessageComposer onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
