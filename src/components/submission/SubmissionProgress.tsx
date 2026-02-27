"use client";

import React from "react";
import { Circle, Loader2, Check, X } from "lucide-react";
import type { SubmissionStep } from "@/types/submission";

export interface SubmissionProgressProps {
  /** The submission pipeline steps with their current status */
  steps: SubmissionStep[];
  /** Callback invoked when a failed step's retry button is clicked */
  onRetry: (stepName: string) => void;
}

function StatusIcon({ status }: { status: SubmissionStep["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span
          data-testid="status-pending"
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border text-muted-foreground"
          aria-label="Pending"
        >
          <Circle className="h-4 w-4" />
        </span>
      );

    case "in_progress":
      return (
        <span
          data-testid="status-in_progress"
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 text-blue-500"
          aria-label="In progress"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      );

    case "success":
      return (
        <span
          data-testid="status-success"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600"
          aria-label="Success"
        >
          <Check className="h-5 w-5" />
        </span>
      );

    case "failed":
      return (
        <span
          data-testid="status-failed"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600"
          aria-label="Failed"
        >
          <X className="h-5 w-5" />
        </span>
      );
  }
}

/**
 * Single-step progress display for the GitHub PR submission pipeline.
 *
 * Shows the "Creating GitHub PR" step with pending/in_progress/success/failed
 * status icon, a clickable PR link on success, and a retry button on failure.
 */
export function SubmissionProgress({
  steps,
  onRetry,
}: SubmissionProgressProps) {
  const step = steps[0];
  if (!step) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-4">
        <StatusIcon status={step.status} />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            Creating GitHub PR
          </span>

          {/* PR link on success */}
          {step.status === "success" && step.artifactLink && (
            <a
              href={step.artifactLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline hover:text-primary/80"
              aria-label="View pull request"
            >
              View pull request
            </a>
          )}

          {/* Error message and retry on failure */}
          {step.status === "failed" && (
            <div className="flex flex-col gap-1">
              {step.error && (
                <span className="text-xs text-red-600">
                  {step.error}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRetry(step.name)}
                className="w-fit rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                aria-label="Retry"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
