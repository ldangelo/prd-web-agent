"use client";

/**
 * New PRD page.
 *
 * Allows the user to select a project, provide an optional description,
 * and start a new PRD creation flow via the agent.
 *
 * Flow:
 *   Phase 1 — POST /api/prds → { prdId }
 *   Phase 2 — POST /api/prds/{prdId}/generate → SSE stream of generation events
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
}

export default function NewPrdPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const streamingPreviewRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const body = await res.json();
          setProjects(body.data ?? []);
        }
      } catch {
        // Silently fail - user can retry
      }
    }
    loadProjects();
  }, []);

  // Auto-scroll the streaming preview as new content arrives
  useEffect(() => {
    if (streamingPreviewRef.current) {
      streamingPreviewRef.current.scrollTop =
        streamingPreviewRef.current.scrollHeight;
    }
  }, [streamingText]);

  async function handleStart() {
    if (!projectId) {
      setError("Please select a project");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }

    setStreamingText("");
    setIsSubmitting(true);
    setError(null);

    let prdId: string;

    // Phase 1 — Create PRD record
    try {
      const res = await fetch("/api/prds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title: title.trim(), description }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to create PRD");
        setIsSubmitting(false);
        return;
      }

      const body = await res.json();
      prdId = body.data.prdId;
    } catch {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
      return;
    }

    // Phase 2 — batch isSubmitting=false + isGenerating=true in same render
    setIsSubmitting(false);
    setIsGenerating(true);
    setStreamingText("");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let savedPrdId: string | null = null;

    try {
      const res = await fetch(`/api/prds/${prdId}/generate`, {
        method: "POST",
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error ?? `Generation failed (HTTP ${res.status})`);
        return;
      }

      if (!res.body) {
        setError("No response body from generate endpoint");
        return;
      }

      // Parse SSE stream — same pattern as ChatInterface.tsx
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);

              if (currentEvent === "text_delta") {
                setStreamingText((prev) => prev + (parsed.delta ?? ""));
              } else if (currentEvent === "prd_saved") {
                savedPrdId = parsed.prdId ?? prdId;
              } else if (currentEvent === "error") {
                setError(parsed.error ?? "Generation error");
                reader.cancel().catch(() => {});
                return;
              }
            } catch {
              // Skip malformed JSON
            }
          } else if (line === "") {
            // Empty line = end of SSE event block; reset for next event
            currentEvent = "";
          }
        }
      }
    } catch {
      setError("Network error during generation. Please try again.");
      return;
    } finally {
      setIsGenerating(false);
    }

    // Navigate after stream ends
    if (savedPrdId) {
      router.push(`/prd/${savedPrdId}?tab=content`);
    } else {
      router.push(`/prd/${prdId}?tab=chat`);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New PRD</h1>
      <p className="mt-2 text-muted-foreground">
        Create a new PRD with AI-assisted authoring.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {isGenerating ? (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Generating your PRD...</h2>
          <p className="text-sm text-muted-foreground">
            This may take a moment.
          </p>
          {streamingText && (
            <div
              ref={streamingPreviewRef}
              className="mt-4 rounded border border-border bg-muted p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
            >
              {streamingText}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="project-select"
              className="block text-sm font-medium"
            >
              Project
            </label>
            <select
              id="project-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 block w-full rounded border border-input bg-background p-2 text-foreground"
            >
              <option value="">Select a project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prd-title" className="block text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="prd-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short name for this PRD"
              className="mt-1 block w-full rounded border border-input bg-background p-2 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Briefly describe what this PRD should cover..."
              className="mt-1 block w-full rounded border border-input bg-background p-2 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <button
            onClick={handleStart}
            disabled={isSubmitting}
            className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Start"}
          </button>
        </div>
      )}
    </main>
  );
}
