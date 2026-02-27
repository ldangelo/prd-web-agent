/**
 * Integration services barrel export.
 *
 * Re-exports all external integration services and shared types
 * for the submission pipeline.
 */

export { ConfluenceService } from "./confluence-service";
export { JiraService } from "./jira-service";
export { GitService } from "./git-service";
export type { CreatePrOptions } from "./git-service";
export { BeadsService } from "./beads-service";
export type {
  IntegrationConfig,
  ConfluencePageResult,
  JiraEpicResult,
  GitPrResult,
  BeadsIssueResult,
  SubmissionStep,
  StepExecutor,
} from "./types";
