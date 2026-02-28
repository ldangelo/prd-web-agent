"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SubmissionProgress } from "./SubmissionProgress";
import type { SubmissionStep } from "@/types/submission";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isTerminal) {
        onClose();
      }
    },
    [isTerminal, onClose],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (!isTerminal) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!isTerminal) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Submitting PRD</DialogTitle>
          <DialogDescription>
            Creating a GitHub pull request for your PRD submission.
          </DialogDescription>
        </DialogHeader>

        <SubmissionProgress steps={steps} onRetry={handleRetry} />

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={!isTerminal}
            aria-label="Close"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
