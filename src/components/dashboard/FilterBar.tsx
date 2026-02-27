/**
 * FilterBar - Filter controls for the PRD dashboard.
 *
 * Provides dropdowns for project, status, author, a tag text input,
 * and date range picker (from/to inputs).
 */
"use client";

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
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
      {/* Project filter */}
      <div className="flex flex-col">
        <label
          htmlFor="filter-project"
          className="mb-1 text-xs font-medium text-gray-600"
        >
          Project
        </label>
        <select
          id="filter-project"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
      <div className="flex flex-col">
        <label
          htmlFor="filter-status"
          className="mb-1 text-xs font-medium text-gray-600"
        >
          Status
        </label>
        <select
          id="filter-status"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
      <div className="flex flex-col">
        <label
          htmlFor="filter-author"
          className="mb-1 text-xs font-medium text-gray-600"
        >
          Author
        </label>
        <select
          id="filter-author"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
      <div className="flex flex-col">
        <label
          htmlFor="filter-tags"
          className="mb-1 text-xs font-medium text-gray-600"
        >
          Tags
        </label>
        <input
          id="filter-tags"
          type="text"
          placeholder="e.g. auth,security"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={filters.tags || ""}
          onChange={(e) => handleChange("tags", e.target.value)}
        />
      </div>

      {/* Date range */}
      <div className="flex flex-col">
        <label
          htmlFor="filter-from"
          className="mb-1 text-xs font-medium text-gray-600"
        >
          From
        </label>
        <input
          id="filter-from"
          type="date"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={filters.from || ""}
          onChange={(e) => handleChange("from", e.target.value)}
        />
      </div>

      <div className="flex flex-col">
        <label
          htmlFor="filter-to"
          className="mb-1 text-xs font-medium text-gray-600"
        >
          To
        </label>
        <input
          id="filter-to"
          type="date"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={filters.to || ""}
          onChange={(e) => handleChange("to", e.target.value)}
        />
      </div>
    </div>
  );
}
