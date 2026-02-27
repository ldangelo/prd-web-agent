"use client";

import React from "react";

interface StreamingMessageProps {
  chunks: string[];
  isStreaming: boolean;
}

export function StreamingMessage({ chunks, isStreaming }: StreamingMessageProps) {
  const text = chunks.join("");

  if (!text && !isStreaming) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 self-start max-w-[80%] px-4">
      {text && (
        <div className="rounded-lg bg-gray-100 px-4 py-2 text-gray-900">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      )}
      {isStreaming && (
        <div
          aria-label="Agent is typing"
          className="flex items-center gap-1 text-xs text-gray-400"
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 delay-75" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 delay-150" />
        </div>
      )}
    </div>
  );
}
