/**
 * PRD Dashboard page.
 *
 * Client component that displays a filterable, searchable list of PRDs
 * with navigation to individual PRD detail pages.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  PrdListItem,
  SearchBar,
} from "@/components/dashboard";
import type { PrdListItemData, FilterValues } from "@/components/dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";

// ---------------------------------------------------------------------------
// Compact filter input styles for inline table header filters
// ---------------------------------------------------------------------------

const filterSelectClass =
  "h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";
const filterInputClass =
  "h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FilterOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [items, setItems] = useState<PrdListItemData[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<FilterValues>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<FilterOption[]>([]);
  const [authors, setAuthors] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Fetch PRDs from API
  // -------------------------------------------------------------------------

  const fetchPrds = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(pagination.limit));

        if (filters.project) params.set("project", filters.project);
        if (filters.status) params.set("status", filters.status);
        if (filters.author) params.set("author", filters.author);
        if (filters.tags) params.set("tags", filters.tags);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);

        const response = await fetch(`/api/prds?${params.toString()}`);
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error || "Failed to fetch PRDs");
        }

        setItems(body.data.items);
        setPagination(body.data.pagination);

        // Collect unique projects and authors for filter options
        const projectMap = new Map<string, string>();
        const authorMap = new Map<string, string>();
        for (const item of body.data.items) {
          if (item.project) projectMap.set(item.project.id, item.project.name);
          if (item.author) authorMap.set(item.author.id, item.author.name);
        }
        setProjects(
          Array.from(projectMap, ([id, name]) => ({ id, name })),
        );
        setAuthors(
          Array.from(authorMap, ([id, name]) => ({ id, name })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit],
  );

  // -------------------------------------------------------------------------
  // Search via OpenSearch
  // -------------------------------------------------------------------------

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      // Clear search, reload from main API
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`/api/search?${params.toString()}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Search failed");
      }

      // Map search results to PrdListItemData shape
      const searchItems: PrdListItemData[] = body.data.hits.map(
        (hit: any) => ({
          id: hit.id,
          title: hit.title,
          status: hit.status,
          tags: hit.tags || [],
          currentVersion: hit.version || 1,
          updatedAt: hit.updatedAt || new Date().toISOString(),
          project: { id: hit.projectId, name: hit.projectId },
          author: { id: hit.authorId, name: hit.authorId },
        }),
      );

      setItems(searchItems);
      setPagination({
        page: 1,
        limit: 20,
        total: body.data.total,
        totalPages: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchPrds(pagination.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, searchQuery]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleFilterChange(newFilters: FilterValues) {
    setFilters(newFilters);
    setSearchQuery("");
  }

  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchPrds(newPage);
    }
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">PRD Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse, filter, and search product requirement documents.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-4 max-w-md">
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* PRD table with inline column filters */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {/* Column labels */}
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="whitespace-nowrap">Author</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="whitespace-nowrap">Updated</TableHead>
              <TableHead className="whitespace-nowrap">Version</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
            {/* Inline filters — each aligns directly above its column */}
            <TableRow>
              <TableHead />{/* Title — use search bar above */}
              <TableHead>
                <select
                  aria-label="Filter by project"
                  className={filterSelectClass}
                  value={filters.project || ""}
                  onChange={(e) =>
                    handleFilterChange({ ...filters, project: e.target.value || undefined })
                  }
                >
                  <option value="">All</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </TableHead>
              <TableHead>
                <select
                  aria-label="Filter by author"
                  className={filterSelectClass}
                  value={filters.author || ""}
                  onChange={(e) =>
                    handleFilterChange({ ...filters, author: e.target.value || undefined })
                  }
                >
                  <option value="">All</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </TableHead>
              <TableHead>
                <select
                  aria-label="Filter by status"
                  className={filterSelectClass}
                  value={filters.status || ""}
                  onChange={(e) =>
                    handleFilterChange({ ...filters, status: e.target.value || undefined })
                  }
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="SUBMITTED">Submitted</option>
                </select>
              </TableHead>
              <TableHead>
                <input
                  type="text"
                  aria-label="Filter by tags"
                  placeholder="e.g. auth"
                  className={filterInputClass}
                  value={filters.tags || ""}
                  onChange={(e) =>
                    handleFilterChange({ ...filters, tags: e.target.value || undefined })
                  }
                />
              </TableHead>
              <TableHead>
                <div className="flex flex-col gap-1">
                  <input
                    type="date"
                    aria-label="Filter from date"
                    className={filterInputClass}
                    value={filters.from || ""}
                    onChange={(e) =>
                      handleFilterChange({ ...filters, from: e.target.value || undefined })
                    }
                  />
                  <input
                    type="date"
                    aria-label="Filter to date"
                    className={filterInputClass}
                    value={filters.to || ""}
                    onChange={(e) =>
                      handleFilterChange({ ...filters, to: e.target.value || undefined })
                    }
                  />
                </div>
              </TableHead>
              <TableHead />{/* Version — no filter */}
              <TableHead />{/* Actions — no filter */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  Loading PRDs...
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No PRDs found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
            {!loading && items.map((item) => (
              <PrdListItem
                key={item.id}
                prd={item}
                currentUserId={currentUserId}
                onDeleted={handleDeleted}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(
              pagination.page * pagination.limit,
              pagination.total,
            )}{" "}
            of {pagination.total} results
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      <Toaster />
    </main>
  );
}
