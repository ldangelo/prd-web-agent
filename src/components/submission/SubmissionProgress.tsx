"use client";

import React from "react";
import type { SubmissionStep, SubmissionStepName } from "@/types/submission";

export interface SubmissionProgressProps {
  /** The submission pipeline steps with their current status */
  steps: SubmissionStep[];
  /** Callback invoked when a failed step's retry button is clicked */
  onRetry: (stepName: string) => void;
}

const STEP_LABELS: Record<SubmissionStepName, string> = {
  confluence: "Confluence",
  jira: "Jira",
  git: "Git",
  beads: "Beads",
};

function StatusIcon({ status }: { status: SubmissionStep["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span
          data-testid="status-pending"
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 text-gray-400"
          aria-label="Pending"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
          </svg>
        </span>
      );

    case "in_progress":
      return (
        <span
          data-testid="status-in_progress"
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 text-blue-500"
          aria-label="In progress"
        >
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>
      );

    case "success":
      return (
        <span
          data-testid="status-success"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600"
          aria-label="Success"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
      );

    case "failed":
      return (
        <span
          data-testid="status-failed"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600"
          aria-label="Failed"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </span>
      );
  }
}

/**
 * 4-step horizontal progress stepper for the submission pipeline.
 *
 * Displays Confluence, Jira, Git, and Beads steps with status icons,
 * retry buttons for failed steps, and artifact links for successful ones.
 */
export function SubmissionProgress({
  steps,
  onRetry,
}: SubmissionProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.name}>
            {/* Step */}
            <div className="flex flex-col items-center gap-2">
              <StatusIcon status={step.status} />
              <span className="text-sm font-medium text-gray-700">
                {STEP_LABELS[step.name]}
              </span>

              {/* Artifact link for successful steps */}
              {step.status === "success" && step.artifactLink && (
                <a
                  href={step.artifactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                  aria-label="View artifact"
                >
                  View artifact
                </a>
              )}

              {/* Error message and retry for failed steps */}
              {step.status === "failed" && (
                <div className="flex flex-col items-center gap-1">
                  {step.error && (
                    <span className="max-w-[120px] text-center text-xs text-red-600">
                      {step.error}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRetry(step.name)}
                    className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                    aria-label={`Retry ${STEP_LABELS[step.name]}`}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                data-testid="step-connector"
                className="mx-2 h-0.5 flex-1 bg-gray-300"
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
