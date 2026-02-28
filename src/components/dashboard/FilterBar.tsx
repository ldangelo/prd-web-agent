/**
 * FilterBar - Filter controls for the PRD dashboard.
 *
 * Provides dropdowns for project, status, author, a tag text input,
 * and date range picker (from/to inputs).
 */
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterValues {
  project?: string;
  status?: string;
  author?: string;
  tags?: string;
  from?: string;
  to?: string;
}

interface FilterBarProps {
  projects: { id: string; name: string }[];
  authors: { id: string; name: string }[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

// ---------------------------------------------------------------------------
// Shared native select styles (consistent with shadcn Input styling)
// ---------------------------------------------------------------------------

const selectClassName = cn(
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterBar({
  projects,
  authors,
  filters,
  onFilterChange,
}: FilterBarProps) {
  function handleChange(key: keyof FilterValues, value: string) {
    onFilterChange({
      ...filters,
      [key]: value || undefined,
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
      {/* Project filter */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-project">Project</Label>
        <select
          id="filter-project"
          className={selectClassName}
          value={filters.project || ""}
          onChange={(e) => handleChange("project", e.target.value)}
        >
          <option value="">All</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-status">Status</Label>
        <select
          id="filter-status"
          className={selectClassName}
          value={filters.status || ""}
          onChange={(e) => handleChange("status", e.target.value)}
        >
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="SUBMITTED">Submitted</option>
        </select>
      </div>

      {/* Author filter */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-author">Author</Label>
        <select
          id="filter-author"
          className={selectClassName}
          value={filters.author || ""}
          onChange={(e) => handleChange("author", e.target.value)}
        >
          <option value="">All</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tags filter */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-tags">Tags</Label>
        <Input
          id="filter-tags"
          type="text"
          placeholder="e.g. auth,security"
          value={filters.tags || ""}
          onChange={(e) => handleChange("tags", e.target.value)}
        />
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-from">From</Label>
        <Input
          id="filter-from"
          type="date"
          value={filters.from || ""}
          onChange={(e) => handleChange("from", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-to">To</Label>
        <Input
          id="filter-to"
          type="date"
          value={filters.to || ""}
          onChange={(e) => handleChange("to", e.target.value)}
        />
      </div>
    </div>
  );
}
