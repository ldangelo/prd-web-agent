/**
 * Types for the PRD submission pipeline.
 */

export type SubmissionStepName = "confluence" | "jira" | "git" | "beads";

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
