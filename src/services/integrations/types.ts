/**
 * Shared types for external integration services.
 *
 * Provides configuration interfaces used across GitHub integration.
 */

export interface IntegrationConfig {
  githubRepo?: string;
}

export interface GitHubPrResult {
  prUrl: string;
  prNumber: number;
  branch: string;
}

/**
 * Result of a single submission pipeline step.
 */
export interface SubmissionStep {
  name: string;
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
