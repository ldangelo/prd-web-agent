"use client";

/**
 * New PRD page.
 *
 * Allows the user to select a project, provide an optional description,
 * and start a new PRD creation flow via the agent.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
}

export default function NewPrdPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleStart() {
    if (!projectId) {
      setError("Please select a project");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/prds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, description }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to create PRD");
        return;
      }

      const body = await res.json();
      router.push(`/prd/${body.data.prdId}?tab=chat`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New PRD</h1>
      <p className="mt-2 text-gray-600">
        Create a new PRD with AI-assisted authoring.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="project-select" className="block text-sm font-medium">
            Project
          </label>
          <select
            id="project-select"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 p-2"
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
          <label htmlFor="description" className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Briefly describe what this PRD should cover..."
            className="mt-1 block w-full rounded border border-gray-300 p-2"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          onClick={handleStart}
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Start"}
        </button>
      </div>
    </main>
  );
}
