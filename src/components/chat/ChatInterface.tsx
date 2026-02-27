"use client";

import React, { useCallback, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./MessageList";
import { StreamingMessage } from "./StreamingMessage";
import { ErrorBanner } from "./ErrorBanner";
import { ToolCallIndicator } from "./ToolCallIndicator";
import { MessageComposer } from "./MessageComposer";

interface ChatInterfaceProps {
  sessionId: string | null;
  onSessionReady?: (sessionId: string) => void;
}

export function ChatInterface({ sessionId, onSessionReady }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingChunks, setStreamingChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isToolActive, setIsToolActive] = useState(false);

  const handleSend = useCallback(
    (text: string, images?: File[]) => {
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
        images: images
          ? images.map((f) => URL.createObjectURL(f))
          : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      // WebSocket integration will be wired in a later task.
      // For now the component manages local state only.
    },
    [],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    // Retry logic will be wired with WebSocket integration
  }, []);

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} />
      <StreamingMessage chunks={streamingChunks} isStreaming={isStreaming} />
      <ToolCallIndicator toolName={activeTool} isActive={isToolActive} />
      <ErrorBanner error={error} retryable={!!error} onRetry={handleRetry} />
      <MessageComposer onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
