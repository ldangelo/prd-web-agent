"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SubmissionProgress } from "./SubmissionProgress";
import type { SubmissionStep } from "@/types/submission";

export interface SubmissionModalProps {
  /** The PRD ID to submit */
  prdId: string;
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
}

const INITIAL_STEPS: SubmissionStep[] = [
  { name: "github", status: "pending" },
];

const POLL_INTERVAL_MS = 2000;

/**
 * Modal overlay that manages the PRD submission pipeline.
 *
 * On open, POSTs to /api/prds/[id]/submit to start the pipeline,
 * then polls /api/prds/[id]/submit/status for progress updates.
 * Shows a single "Creating GitHub PR" step with success/failure state.
 * The close button is only enabled when the step is terminal (success/failed).
 */
export function SubmissionModal({
  prdId,
  isOpen,
  onClose,
}: SubmissionModalProps) {
  const [steps, setSteps] = useState<SubmissionStep[]>(INITIAL_STEPS);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTerminal = steps.every(
    (s) => s.status === "success" || s.status === "failed",
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/prds/${prdId}/submit/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.steps) {
          setSteps(data.steps);

          const allTerminal = data.steps.every(
            (s: SubmissionStep) =>
              s.status === "success" || s.status === "failed",
          );
          if (allTerminal) {
            stopPolling();
          }
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [prdId, stopPolling]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset steps
    setSteps(INITIAL_STEPS);

    // Start submission
    fetch(`/api/prds/${prdId}/submit`, { method: "POST" })
      .then(() => {
        // Start polling
        pollStatus();
        pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
      })
      .catch(() => {
        // If POST fails, still try polling
        pollStatus();
      });

    return () => {
      stopPolling();
    };
  }, [isOpen, prdId, pollStatus, stopPolling]);

  const handleRetry = useCallback(
    async (stepName: string) => {
      try {
        await fetch(`/api/prds/${prdId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retryStep: stepName }),
        });

        // Resume polling if stopped
        if (!pollRef.current) {
          pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
        }
      } catch {
        // Silently ignore retry errors
      }
    },
    [prdId, pollStatus],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Submitting PRD"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Submitting PRD
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={!isTerminal}
            className="rounded px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <SubmissionProgress steps={steps} onRetry={handleRetry} />
      </div>
    </div>
  );
}
