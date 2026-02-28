/**
 * PrdListItem - Table row component for displaying a single PRD.
 *
 * Shows title, project, author, status (colored badge), tags (pills),
 * last updated date, and version. Clicking navigates to the PRD detail page.
 */
"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const STATUS_CONFIG: Record<
  PrdStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  DRAFT: {
    label: "Draft",
    variant: "outline",
  },
  IN_REVIEW: {
    label: "In Review",
    variant: "secondary",
  },
  APPROVED: {
    label: "Approved",
    variant: "default",
    className: "bg-green-600 hover:bg-green-600/80",
  },
  SUBMITTED: {
    label: "Submitted",
    variant: "default",
    className: "bg-blue-600 hover:bg-blue-600/80",
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
      className="cursor-pointer border-b border-border hover:bg-muted transition-colors"
      onClick={() => router.push(`/prd/${prd.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/prd/${prd.id}`);
        }
      }}
      tabIndex={0}
      role="row"
      aria-label={`${prd.title} - ${STATUS_CONFIG[prd.status].label}`}
    >
      <td className="px-4 py-3 text-sm font-medium text-foreground">
        {prd.title}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {prd.project.name}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {prd.author.name}
      </td>
      <td className="px-4 py-3">
        <Badge variant={statusConfig.variant} className={cn(statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {prd.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formattedDate}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        v{prd.currentVersion}
      </td>
    </tr>
  );
}
