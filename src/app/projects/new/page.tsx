"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/projects";
import type { ProjectFormData } from "@/components/projects/ProjectForm";

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: ProjectFormData) {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to create project");
        return;
      }

      const body = await res.json();
      router.push(`/projects/${body.data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-foreground">Create Project</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set up a new project for organizing PRDs.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-6">
        <ProjectForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </main>
  );
}
