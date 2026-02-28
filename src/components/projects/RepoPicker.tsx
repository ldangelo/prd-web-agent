"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubRepo {
  fullName: string;
  name: string;
  owner: string;
  ownerType: "User" | "Organization";
  description: string | null;
  private: boolean;
  defaultBranch: string;
}

export interface RepoSelection {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
}

export interface RepoPickerProps {
  value?: string;
  onChange: (repo: RepoSelection | null) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RepoPicker({ value, onChange, disabled }: RepoPickerProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch repos on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchRepos() {
      try {
        const response = await fetch("/api/github/repos");
        if (!response.ok) {
          throw new Error("Failed to load repositories");
        }
        const json = await response.json();
        if (!cancelled) {
          // API returns { data: { repos: [{ owner, ownerType, repos: [...] }] } }
          // Flatten grouped repos into a flat array with owner info
          const groups = json.data?.repos ?? [];
          const flat: GitHubRepo[] = [];
          for (const group of groups) {
            for (const repo of group.repos) {
              flat.push({
                fullName: repo.fullName,
                name: repo.name,
                owner: group.owner,
                ownerType: group.ownerType === "user" ? "User" : "Organization",
                description: repo.description,
                private: repo.private,
                defaultBranch: repo.defaultBranch ?? "main",
              });
            }
          }
          setRepos(flat);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load repositories");
          setIsLoading(false);
        }
      }
    }

    fetchRepos();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchTerm(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        setDebouncedSearch(value);
      }, 300);
    },
    [],
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Filter repos based on debounced search
  const filteredRepos = repos.filter((repo) => {
    if (!debouncedSearch) return true;
    const query = debouncedSearch.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      repo.owner.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query))
    );
  });

  // Group filtered repos by owner
  const groupedRepos = new Map<string, GitHubRepo[]>();
  for (const repo of filteredRepos) {
    const existing = groupedRepos.get(repo.owner) || [];
    existing.push(repo);
    groupedRepos.set(repo.owner, existing);
  }

  const handleSelect = useCallback(
    (repo: GitHubRepo) => {
      onChange({
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description || "",
        private: repo.private,
      });
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-md border border-input p-4" aria-busy="true">
        <p className="text-sm text-muted-foreground">Loading repositories...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4" role="alert">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // Selected value display
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
        <span className="text-sm text-foreground">{value}</span>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear selection"
          className="ml-2 text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search repositories..."
        value={searchTerm}
        onChange={handleSearchChange}
        disabled={disabled}
        aria-label="Search repositories"
        className="block w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        {filteredRepos.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground">No repositories found</p>
          </div>
        ) : (
          Array.from(groupedRepos.entries()).map(([owner, ownerRepos]) => (
            <div key={owner}>
              <div className="sticky top-0 bg-muted px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {owner}
                </span>
              </div>
              <ul role="listbox" aria-label={`${owner} repositories`}>
                {ownerRepos.map((repo) => (
                  <li
                    key={repo.fullName}
                    role="option"
                    aria-selected={value === repo.fullName}
                    className="cursor-pointer px-3 py-2 hover:bg-accent"
                    onClick={() => handleSelect(repo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(repo);
                      }
                    }}
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {repo.name}
                      </span>
                      {repo.private && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {repo.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
