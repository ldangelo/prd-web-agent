"use client";

import React, { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
}

export interface AuditTrailProps {
  prdId: string;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AuditTrail({ prdId }: AuditTrailProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prds/${prdId}/audit`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } finally {
      setLoading(false);
    }
  }, [prdId]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        Loading audit trail...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-400">
        No status changes yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Audit Trail</h3>
      <ol className="space-y-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-md border border-gray-200 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {entry.userName}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <StatusBadge status={entry.fromStatus} />
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
              <StatusBadge status={entry.toStatus} />
            </div>
            {entry.comment && (
              <p className="mt-2 text-sm text-gray-600 italic">
                {entry.comment}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
