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
import ReactMarkdown from "react-markdown";

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

  const [descTab, setDescTab] = useState<"write" | "preview">("write");
  const streamingPreviewRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Warn before unloading while generation is in progress
  useEffect(() => {
    if (!isGenerating) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGenerating]);

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
    <main className="flex h-[calc(100vh-3.5rem)] flex-col p-6 gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">New PRD</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new PRD with AI-assisted authoring.
          </p>
        </div>
        {!isGenerating && (
          <button
            onClick={handleStart}
            disabled={isSubmitting}
            className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
          >
            {isSubmitting ? "Creating..." : "Start"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 shrink-0" role="alert">
          {error}
        </p>
      )}

      {isGenerating ? (
        <div className="flex flex-col flex-1 min-h-0">
          <h2 className="text-lg font-semibold shrink-0">Generating your PRD...</h2>
          <p className="text-sm text-muted-foreground shrink-0">This may take a moment.</p>
          {streamingText && (
            <div
              ref={streamingPreviewRef}
              className="mt-4 flex-1 min-h-0 overflow-y-auto rounded border border-border bg-muted p-4 text-sm font-mono whitespace-pre-wrap"
            >
              {streamingText}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Project + Title column */}
          <div className="flex flex-col gap-3 shrink-0">
            <div>
              <label htmlFor="project-select" className="block text-sm font-medium mb-1">
                Project
              </label>
              <select
                id="project-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="block w-full rounded border border-input bg-background p-2 text-foreground text-sm"
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
              <label htmlFor="prd-title" className="block text-sm font-medium mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="prd-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short name for this PRD"
                className="block w-full rounded border border-input bg-background p-2 text-foreground placeholder:text-muted-foreground text-sm"
              />
            </div>
          </div>

          {/* Markdown editor — fills remaining height */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-border shrink-0 mb-0">
              <button
                type="button"
                onClick={() => setDescTab("write")}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  descTab === "write"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setDescTab("preview")}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  descTab === "preview"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Preview
              </button>
              <span className="ml-auto text-xs text-muted-foreground pr-1">Markdown supported</span>
            </div>

            {descTab === "write" ? (
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this PRD should cover. Supports **markdown** formatting."
                className="flex-1 min-h-0 w-full resize-none rounded-b border border-t-0 border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto rounded-b border border-t-0 border-border bg-background p-4">
                {description ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{description}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
