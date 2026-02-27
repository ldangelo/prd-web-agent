"use client";

import React from "react";
import Link from "next/link";

/**
 * Admin dashboard page with navigation links to settings and users.
 */
export default function AdminPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Link
          href="/admin/settings"
          className="block rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-md"
        >
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            Settings
          </h2>
          <p className="text-sm text-gray-600">
            Configure integrations, LLM provider, and workflow settings.
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="block rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-md"
        >
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            User Management
          </h2>
          <p className="text-sm text-gray-600">
            Manage users, roles, and permissions.
          </p>
        </Link>
      </div>
    </main>
  );
}
