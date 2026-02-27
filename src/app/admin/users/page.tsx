"use client";

import React, { useCallback, useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "Author" | "Reviewer" | "Admin";
}

const ROLE_BADGE_COLORS: Record<User["role"], string> = {
  Admin: "bg-purple-100 text-purple-800",
  Author: "bg-blue-100 text-blue-800",
  Reviewer: "bg-green-100 text-green-800",
};

/**
 * Admin user management page.
 *
 * Lists users with role badges, provides add user form,
 * role change dropdowns, and remove buttons with confirmation.
 */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<User["role"]>("Author");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAddUser = useCallback(async () => {
    if (!newName.trim() || !newEmail.trim()) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => [...prev, data.user]);
        setNewName("");
        setNewEmail("");
        setNewRole("Author");
      }
    } catch {
      // Silently handle error
    }
  }, [newName, newEmail, newRole]);

  const handleRoleChange = useCallback(
    async (userId: string, role: User["role"]) => {
      try {
        await fetch(`/api/admin/users/${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });

        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role } : u)),
        );
      } catch {
        // Silently handle error
      }
    },
    [],
  );

  const handleRemoveUser = useCallback(async (userId: string) => {
    try {
      await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmRemoveId(null);
    } catch {
      // Silently handle error
    }
  }, []);

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-muted-foreground">Loading users...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-8 text-2xl font-bold text-foreground">
        User Management
      </h1>

      {/* Add User Form */}
      <section className="mb-8 rounded-lg border border-border p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Add New User
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="new-user-name"
              className="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Name
            </label>
            <input
              id="new-user-name"
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="new-user-email"
              className="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Email
            </label>
            <input
              id="new-user-email"
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="new-user-role"
              className="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Role
            </label>
            <select
              id="new-user-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as User["role"])}
              className="rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="Author">Author</option>
              <option value="Reviewer">Reviewer</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddUser}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add User
          </button>
        </div>
      </section>

      {/* User List */}
      <section className="rounded-lg border border-border">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Users</h2>
        </div>
        {users.length === 0 ? (
          <p className="p-6 text-muted-foreground">No users found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[user.role]}`}
                  >
                    {user.role}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor={`role-${user.id}`} className="sr-only">
                    Change role for {user.name}
                  </label>
                  <select
                    id={`role-${user.id}`}
                    value={user.role}
                    onChange={(e) =>
                      handleRoleChange(
                        user.id,
                        e.target.value as User["role"],
                      )
                    }
                    className="rounded-md border border-input px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Author">Author</option>
                    <option value="Reviewer">Reviewer</option>
                    <option value="Admin">Admin</option>
                  </select>

                  {confirmRemoveId === user.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Confirm?</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(user.id)}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                        aria-label={`Confirm remove ${user.name}`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(null)}
                        className="rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                        aria-label="Cancel remove"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(user.id)}
                      className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                      aria-label={`Remove ${user.name}`}
                    >
                      Remove
                    </button>
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
