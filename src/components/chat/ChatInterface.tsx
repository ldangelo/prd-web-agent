"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./MessageList";
import { StreamingMessage } from "./StreamingMessage";
import { ErrorBanner } from "./ErrorBanner";
import { ToolCallIndicator } from "./ToolCallIndicator";
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
  projectId,
  userId,
  mode = "refine",
  onPrdSaved,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingChunks, setStreamingChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isToolActive, setIsToolActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Connect to Socket.io /agent namespace
  useEffect(() => {
    const socket = io("/agent", {
      auth: { userId },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    // --- Server events ---

    socket.on("agent:message_start", (data: { sessionId: string }) => {
      setSessionId(data.sessionId);
      setIsStreaming(true);
      setStreamingChunks([]);
      setError(null);
    });

    socket.on(
      "agent:text_delta",
      (data: { sessionId: string; delta: string }) => {
        setStreamingChunks((prev) => [...prev, data.delta]);
      },
    );

    socket.on("agent:message_end", () => {
      setIsStreaming(false);
      // Move streaming content to completed messages
      setStreamingChunks((chunks) => {
        if (chunks.length > 0) {
          const content = chunks.join("");
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
        return [];
      });
    });

    socket.on(
      "agent:tool_start",
      (data: { sessionId: string; toolName: string }) => {
        setActiveTool(data.toolName);
        setIsToolActive(true);
      },
    );

    socket.on("agent:tool_end", () => {
      setIsToolActive(false);
      setActiveTool(null);
    });

    socket.on(
      "agent:prd_saved",
      (data: { prdId: string; version: number }) => {
        onPrdSaved?.(data.prdId, data.version);
      },
    );

    socket.on(
      "agent:error",
      (data: { sessionId: string; error: string; retryable: boolean }) => {
        setIsStreaming(false);
        setError(data.error);
      },
    );

    // Start the agent session
    socket.emit("agent:start", {
      prdId,
      projectId,
      mode,
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [prdId, projectId, userId, mode, onPrdSaved]);

  const handleSend = useCallback(
    (text: string, images?: File[]) => {
      if (!socketRef.current || !sessionId) return;

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
        images: images ? images.map((f) => URL.createObjectURL(f)) : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      socketRef.current.emit("agent:message", {
        sessionId,
        text,
      });
    },
    [sessionId],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    if (socketRef.current) {
      socketRef.current.emit("agent:start", {
        prdId,
        projectId,
        mode,
      });
    }
  }, [prdId, projectId, mode]);

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
