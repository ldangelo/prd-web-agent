"use client";

/**
 * VersionHistory - Fetches and displays version history for a PRD.
 *
 * Shows a chronological list of versions with version number, author,
 * timestamp, and change summary. Clicking a version loads its content
 * via the onVersionSelect callback.
 */

import { useEffect, useState } from "react";

export interface VersionEntry {
  id: string;
  version: number;
  authorId: string;
  changeSummary: string | null;
  createdAt: string;
}

export interface VersionHistoryProps {
  prdId: string;
  onVersionSelect?: (content: string) => void;
}

export function VersionHistory({ prdId, onVersionSelect }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  useEffect(() => {
    async function fetchVersions() {
      try {
        const response = await fetch(`/api/prds/${prdId}/versions`);
        if (!response.ok) {
          setError("Failed to load version history");
          return;
        }
        const body = await response.json();
        setVersions(body.data);
      } catch {
        setError("Failed to load version history");
      } finally {
        setLoading(false);
      }
    }

    fetchVersions();
  }, [prdId]);

  async function handleVersionClick(version: number) {
    setSelectedVersion(version);

    if (onVersionSelect) {
      try {
        const response = await fetch(
          `/api/prds/${prdId}/versions/${version}`,
        );
        if (response.ok) {
          const body = await response.json();
          onVersionSelect(body.data.content);
        }
      } catch {
        // Silently handle error for now
      }
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading versions...</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">{error}</p>
    );
  }

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No versions available.</p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Version History
      </h3>
      <ul className="divide-y divide-border" role="list">
        {versions.map((v) => (
          <li key={v.id} className="py-3">
            <button
              type="button"
              onClick={() => handleVersionClick(v.version)}
              className={`w-full text-left rounded px-3 py-2 transition-colors hover:bg-muted ${
                selectedVersion === v.version
                  ? "bg-accent ring-1 ring-ring"
                  : ""
              }`}
              aria-current={selectedVersion === v.version ? "true" : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  Version {v.version}
                </span>
                <time
                  dateTime={v.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {new Date(v.createdAt).toLocaleDateString()}
                </time>
              </div>
              {v.changeSummary && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {v.changeSummary}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                by {v.authorId}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
