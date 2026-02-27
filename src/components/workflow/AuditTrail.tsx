"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
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
      <div className="py-4 text-center text-sm text-muted-foreground">
        Loading audit trail...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No status changes yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Audit Trail</h3>
      <ol className="space-y-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-md border border-border px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {entry.userName}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <StatusBadge status={entry.fromStatus} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <StatusBadge status={entry.toStatus} />
            </div>
            {entry.comment && (
              <p className="mt-2 text-sm text-muted-foreground italic">
                {entry.comment}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
