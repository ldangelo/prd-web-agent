"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProjectForm } from "@/components/projects";
import type { ProjectFormData } from "@/components/projects";

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [initialData, setInitialData] = useState<Partial<ProjectFormData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          throw new Error("Failed to load project");
        }
        const json = await res.json();
        const p = json.data;
        setInitialData({
          name: p.name ?? "",
          description: p.description ?? "",
          githubRepo: p.githubRepo ?? "",
          defaultLabels: p.defaultLabels ?? [],
          defaultReviewers: p.defaultReviewers ?? [],
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load project",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  const handleSubmit = useCallback(
    async (data: ProjectFormData) => {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          throw new Error("Failed to save project");
        }
        router.push(`/projects/${projectId}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save project",
        );
        setIsSaving(false);
      }
    },
    [projectId, router],
  );

  const handleCancel = useCallback(() => {
    router.push(`/projects/${projectId}`);
  }, [projectId, router]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-gray-500">Loading project...</p>
      </main>
    );
  }

  if (error && !initialData) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-md bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-6">
        <ProjectForm
          initialData={initialData ?? undefined}
          onSubmit={handleSubmit}
          isLoading={isSaving}
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}
