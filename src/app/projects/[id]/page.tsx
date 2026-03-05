"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

type ProjectRole = "MEMBER" | "REVIEWER" | "SUBMITTER" | "APPROVER" | "ADMIN";

interface MemberUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface Member {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  user: MemberUser;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  githubRepo: string;
  defaultLabels: string[];
  defaultReviewers: string[];
}

const ROLE_LABELS: Record<ProjectRole, string> = {
  MEMBER: "Member",
  REVIEWER: "Reviewer",
  SUBMITTER: "Submitter",
  APPROVER: "Approver",
  ADMIN: "Admin",
};

const ROLE_COLORS: Record<ProjectRole, string> = {
  MEMBER: "bg-secondary text-secondary-foreground",
  REVIEWER: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  SUBMITTER: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  APPROVER: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  ADMIN: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member form state
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<ProjectRole>("MEMBER");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Role update state
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const currentUserId = session?.user?.id ?? "";
  const isSystemAdmin = session?.user?.role === "ADMIN";

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) return;
      const json = await res.json();
      setMembers(json.data ?? []);
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error("Failed to load project");
        const json = await res.json();
        setProject(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProject();
    fetchMembers();
  }, [projectId, fetchMembers]);

  // Determine if current user is a project ADMIN (or system ADMIN)
  const myMembership = members.find((m) => m.userId === currentUserId);
  const isProjectAdmin = isSystemAdmin || myMembership?.role === "ADMIN";

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error ?? "Failed to add member");
        return;
      }
      setAddEmail("");
      setAddRole("MEMBER");
      await fetchMembers();
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRoleChange(targetUserId: string, newRole: ProjectRole) {
    setUpdatingUserId(targetUserId);
    try {
      await fetch(`/api/projects/${projectId}/members/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      await fetchMembers();
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleRemove(targetUserId: string) {
    if (!confirm("Remove this member from the project?")) return;
    setRemovingUserId(targetUserId);
    try {
      await fetch(`/api/projects/${projectId}/members/${targetUserId}`, {
        method: "DELETE",
      });
      await fetchMembers();
    } finally {
      setRemovingUserId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-muted-foreground">Loading project...</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-md bg-destructive/10 p-4" role="alert">
          <p className="text-sm text-destructive">{error ?? "Project not found"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
        {isSystemAdmin && (
          <Link
            href={`/projects/${projectId}/edit`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Edit Project
          </Link>
        )}
      </div>

      {project.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}

      {/* GitHub Settings */}
      <section aria-labelledby="github-heading">
        <h2 id="github-heading" className="text-lg font-semibold text-foreground">
          GitHub Settings
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border p-4">
            <dt className="text-sm font-medium text-muted-foreground">GitHub Repository</dt>
            <dd className="mt-1 text-sm text-foreground">{project.githubRepo}</dd>
          </div>
          <div className="rounded-md border border-border p-4">
            <dt className="text-sm font-medium text-muted-foreground">Default Labels</dt>
            <dd className="mt-1 text-sm text-foreground">
              {project.defaultLabels.length > 0 ? project.defaultLabels.join(", ") : "None"}
            </dd>
          </div>
          <div className="rounded-md border border-border p-4">
            <dt className="text-sm font-medium text-muted-foreground">Default Reviewers</dt>
            <dd className="mt-1 text-sm text-foreground">
              {project.defaultReviewers.length > 0 ? project.defaultReviewers.join(", ") : "None"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Members */}
      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-lg font-semibold text-foreground mb-4">
          Members
        </h2>

        {/* Add member form — admins only */}
        {isProjectAdmin && (
          <form onSubmit={handleAddMember} className="mb-4 flex gap-2 items-start flex-wrap">
            <div className="flex flex-col gap-1">
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="Email address"
                required
                className="rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as ProjectRole)}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {(Object.keys(ROLE_LABELS) as ProjectRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addLoading}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addLoading ? "Adding..." : "Add Member"}
            </button>
            {addError && (
              <p className="w-full text-xs text-destructive mt-1">{addError}</p>
            )}
          </form>
        )}

        {/* Members table */}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Role</th>
                  {isProjectAdmin && (
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => (
                  <tr key={member.id} className="bg-background hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {member.user.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{member.user.email}</td>
                    <td className="px-4 py-3">
                      {isProjectAdmin ? (
                        <select
                          value={member.role}
                          disabled={updatingUserId === member.userId}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value as ProjectRole)}
                          className="rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {(Object.keys(ROLE_LABELS) as ProjectRole[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[member.role]}`}>
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </td>
                    {isProjectAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemove(member.userId)}
                          disabled={removingUserId === member.userId}
                          className="text-xs text-destructive hover:underline disabled:opacity-50"
                        >
                          {removingUserId === member.userId ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
