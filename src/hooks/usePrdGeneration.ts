"use client";

/**
 * usePrdGeneration hook.
 *
 * Manages the lifecycle of PRD content loading and real-time generation
 * streaming. Fetches the latest version on mount, connects to Socket.io
 * for streaming updates during generation, and provides state for the UI.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrdVersionData {
  id: string;
  version: number;
  content: string;
  changeSummary: string | null;
  createdAt: string;
}

interface LatestVersionResponse {
  data: {
    prd: {
      id: string;
      title: string;
      status: string;
      generationStatus: string | null;
      generationError: string | null;
      currentVersion: number;
    };
    version: PrdVersionData | null;
  };
}

export interface UsePrdGenerationResult {
  content: string;
  title: string;
  status: string;
  isGenerating: boolean;
  streamingText: string;
  error: string | null;
  refreshContent: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePrdGeneration(prdId: string): UsePrdGenerationResult {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const streamingTextRef = useRef("");

  const fetchLatestVersion = useCallback(async () => {
    try {
      const res = await fetch(`/api/prds/${prdId}/versions/latest`);
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      const json: LatestVersionResponse = await res.json();
      const { prd, version } = json.data;

      setTitle(prd.title);
      setStatus(prd.status);

      if (version) {
        setContent(version.content);
        setStreamingText("");
        streamingTextRef.current = "";
      }

      const status = prd.generationStatus;
      if (status === "pending" || status === "generating") {
        setIsGenerating(true);
      } else if (status === "failed") {
        setIsGenerating(false);
        setError(prd.generationError ?? "Generation failed");
      } else {
        setIsGenerating(false);
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load PRD content");
    }
  }, [prdId]);

  // Connect to Socket.io for real-time updates
  useEffect(() => {
    let socket: any = null;
    let cleanup = false;

    async function connectSocket() {
      try {
        // Dynamic import to avoid SSR issues
        const { io } = await import("socket.io-client");

        if (cleanup) return;

        socket = io("/agent", {
          auth: { userId: "current" }, // Auth will be resolved server-side
          transports: ["websocket", "polling"],
        });

        socketRef.current = socket;

        socket.on("agent:text_delta", (data: { delta: string }) => {
          streamingTextRef.current += data.delta;
          setStreamingText(streamingTextRef.current);
        });

        socket.on("agent:prd_saved", (_data: { prdId: string; version: number }) => {
          // Content was saved — re-fetch the persisted version
          setStreamingText("");
          streamingTextRef.current = "";
          setIsGenerating(false);
          void fetchLatestVersion();
        });

        socket.on("agent:error", (data: { error: string }) => {
          setError(data.error);
          setIsGenerating(false);
        });

        socket.on("agent:message_start", () => {
          // Reset streaming text for a new message
          streamingTextRef.current = "";
          setStreamingText("");
        });
      } catch {
        // Socket.io not available — polling only
      }
    }

    void connectSocket();

    return () => {
      cleanup = true;
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [prdId, fetchLatestVersion]);

  // Initial fetch
  useEffect(() => {
    void fetchLatestVersion();
  }, [fetchLatestVersion]);

  return {
    content,
    title,
    status,
    isGenerating,
    streamingText,
    error,
    refreshContent: fetchLatestVersion,
  };
}
