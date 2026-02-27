"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Member {
  id: string;
  user: { name: string; email: string };
  role: string;
  isReviewer: boolean;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  githubRepo: string;
  defaultLabels: string[];
  defaultReviewers: string[];
  members: Member[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          throw new Error("Failed to load project");
        }
        const json = await res.json();
        setProject(json.data);
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

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-gray-500">Loading project...</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-md bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">
            {error ?? "Project not found"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <Link
          href={`/projects/${projectId}/edit`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Edit Project
        </Link>
      </div>

      {project.description && (
        <p className="mt-4 text-gray-600">{project.description}</p>
      )}

      <section className="mt-8" aria-labelledby="github-heading">
        <h2
          id="github-heading"
          className="text-lg font-semibold text-gray-900"
        >
          GitHub Settings
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-gray-200 p-4">
            <dt className="text-sm font-medium text-gray-500">
              GitHub Repository
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {project.githubRepo}
            </dd>
          </div>
          <div className="rounded-md border border-gray-200 p-4">
            <dt className="text-sm font-medium text-gray-500">Default Labels</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {project.defaultLabels.length > 0
                ? project.defaultLabels.join(", ")
                : "None"}
            </dd>
          </div>
          <div className="rounded-md border border-gray-200 p-4">
            <dt className="text-sm font-medium text-gray-500">Default Reviewers</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {project.defaultReviewers.length > 0
                ? project.defaultReviewers.join(", ")
                : "None"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="members-heading">
        <div className="flex items-center justify-between">
          <h2
            id="members-heading"
            className="text-lg font-semibold text-gray-900"
          >
            Members
          </h2>
          <button
            type="button"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Member
          </button>
        </div>

        {project.members.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No members yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">
            {project.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.user.name}
                  </p>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {member.role}
                  </span>
                  {member.isReviewer && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Reviewer
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
