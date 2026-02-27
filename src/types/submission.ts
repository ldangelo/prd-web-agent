/**
 * Types for the PRD submission pipeline.
 *
 * Single-step GitHub PR creation model.
 */

export type SubmissionStepName = "github";

export type SubmissionStepStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failed";

export interface SubmissionStep {
  name: SubmissionStepName;
  status: SubmissionStepStatus;
  error?: string;
  artifactLink?: string;
}
