"use client";

import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/chat";

interface MessageListProps {
  messages: ChatMessage[];
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>No messages yet. Start the conversation below.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          data-role={msg.role}
          className={`flex flex-col gap-1 max-w-[80%] ${
            msg.role === "user" ? "self-end items-end" : "self-start items-start"
          }`}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {msg.role === "user" ? "You" : "Agent"}
          </span>
          <div
            className={`rounded-lg px-4 py-2 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.images && msg.images.length > 0 && (
              <div className="mt-2 flex gap-2">
                {msg.images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Attached image ${i + 1}`}
                    className="max-h-40 rounded"
                  />
                ))}
              </div>
            )}
          </div>
          <time
            className="text-xs text-muted-foreground"
            dateTime={msg.timestamp.toISOString()}
          >
            {formatTimestamp(msg.timestamp)}
          </time>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
