/**
 * PrdListItem - Table row component for displaying a single PRD.
 *
 * Shows title, project, author, status (colored badge), tags (pills),
 * last updated date, and version. Clicking navigates to the PRD detail page.
 */
"use client";

import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrdStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUBMITTED";

export interface PrdListItemData {
  id: string;
  title: string;
  status: PrdStatus;
  tags: string[];
  currentVersion: number;
  updatedAt: string;
  project: { id: string; name: string };
  author: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PrdStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800",
  },
  IN_REVIEW: {
    label: "In Review",
    className: "bg-yellow-100 text-yellow-800",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-green-100 text-green-800",
  },
  SUBMITTED: {
    label: "Submitted",
    className: "bg-blue-100 text-blue-800",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrdListItem({ prd }: { prd: PrdListItemData }) {
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[prd.status];

  const formattedDate = new Date(prd.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <tr
      className="cursor-pointer border-b border-gray-200 hover:bg-gray-50 transition-colors"
      onClick={() => router.push(`/prd/${prd.id}`)}
    >
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {prd.title}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {prd.project.name}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {prd.author.name}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
        >
          {statusConfig.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {prd.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
            >
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formattedDate}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        v{prd.currentVersion}
      </td>
    </tr>
  );
}
