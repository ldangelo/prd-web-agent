"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProjectCard } from "@/components/projects";

interface Project {
  id: string;
  name: string;
  description: string;
  _count: { members: number };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) {
          throw new Error("Failed to load projects");
        }
        const json = await res.json();
        setProjects(json.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load projects",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Create Project
        </Link>
      </div>

      {isLoading && (
        <p className="mt-8 text-center text-muted-foreground">Loading projects...</p>
      )}

      {error && (
        <div className="mt-8 rounded-md bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground">
          No projects yet. Create your first project to get started.
        </p>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              description={project.description}
              memberCount={project._count.members}
            />
          ))}
        </div>
      )}
    </main>
  );
}
