/**
 * Shared types for external integration services.
 *
 * Provides configuration interfaces used across Confluence, Jira,
 * Git, and Beads integration services.
 */

export interface IntegrationConfig {
  confluenceUrl?: string;
  confluenceEmail?: string;
  confluenceSpace?: string;
  confluenceToken?: string;
  jiraUrl?: string;
  jiraEmail?: string;
  jiraProject?: string;
  jiraToken?: string;
  gitRepo?: string;
  gitToken?: string;
  beadsProject?: string;
}

export interface ConfluencePageResult {
  pageId: string;
  url: string;
  title: string;
  version: number;
}

export interface JiraEpicResult {
  epicKey: string;
  url: string;
  title: string;
}

export interface GitPrResult {
  prUrl: string;
  prNumber: number;
  branch: string;
}

export interface BeadsIssueResult {
  issueId: string;
}

/**
 * Result of a single submission pipeline step.
 */
export interface SubmissionStep {
  name: "confluence" | "jira" | "git" | "beads";
  status: "pending" | "in_progress" | "success" | "failed";
  error?: string;
  artifactLink?: string;
}

/**
 * Map of step names to their integration executor functions.
 * Each executor receives a PRD ID and config, and returns an artifact link.
 */
export type StepExecutor = (
  prdId: string,
  config: IntegrationConfig,
) => Promise<string>;
