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
  FilterBar,
  SearchBar,
} from "@/components/dashboard";
import type { PrdListItemData, FilterValues } from "@/components/dashboard";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";

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

      {/* Filter bar */}
      <div className="mb-6">
        <FilterBar
          projects={projects}
          authors={authors}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading PRDs...
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No PRDs found. Create one to get started.
          </p>
        </div>
      )}

      {/* PRD table */}
      {!loading && items.length > 0 && (
        <>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
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
            </TableHeader>
            <TableBody>
              {items.map((item) => (
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
        </>
      )}
      <Toaster />
    </main>
  );
}
