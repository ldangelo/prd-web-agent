/**
 * Integration Config Service.
 *
 * Resolves integration configuration by merging global settings
 * with project-level overrides. Project values take precedence
 * when non-null; otherwise the global default is used.
 */
import { prisma } from "@/lib/prisma";
import type { IntegrationConfig } from "./integrations/types";

/**
 * Resolve the effective integration configuration for a project.
 *
 * Loads GlobalSettings from the database, then loads the Project
 * record. Project-level fields override global defaults when they
 * are non-null.
 *
 * @param projectId - The project whose config to resolve
 * @returns Merged IntegrationConfig
 */
export async function resolveIntegrationConfig(
  projectId: string,
): Promise<IntegrationConfig> {
  const [globalSettings, project] = await Promise.all([
    prisma.globalSettings.findUnique({ where: { id: "global" } }),
    prisma.project.findUnique({ where: { id: projectId } }),
  ]);

  const config: IntegrationConfig = {};

  // Start with global defaults
  if (globalSettings) {
    config.confluenceSpace = globalSettings.confluenceSpace ?? undefined;
    config.jiraProject = globalSettings.jiraProject ?? undefined;
    config.gitRepo = globalSettings.gitRepo ?? undefined;
    config.beadsProject = globalSettings.beadsProject ?? undefined;
    config.confluenceToken = globalSettings.confluenceToken ?? undefined;
    config.jiraToken = globalSettings.jiraToken ?? undefined;
    config.gitToken = globalSettings.gitToken ?? undefined;
  }

  // Override with project-level values where non-null
  if (project) {
    if (project.confluenceSpace != null) {
      config.confluenceSpace = project.confluenceSpace;
    }
    if (project.jiraProject != null) {
      config.jiraProject = project.jiraProject;
    }
    if (project.gitRepo != null) {
      config.gitRepo = project.gitRepo;
    }
    if (project.beadsProject != null) {
      config.beadsProject = project.beadsProject;
    }
  }

  return config;
}

/**
 * Redact sensitive token values in settings for API responses.
 *
 * Replaces non-null token fields with a placeholder string.
 * Preserves null values and all non-token fields.
 *
 * @param settings - The raw settings object
 * @returns A copy with token values redacted
 */
export function redactTokens<
  T extends {
    confluenceToken?: string | null;
    jiraToken?: string | null;
    gitToken?: string | null;
  },
>(settings: T): T {
  const REDACTED = "••••••••";
  return {
    ...settings,
    confluenceToken:
      settings.confluenceToken != null ? REDACTED : settings.confluenceToken,
    jiraToken:
      settings.jiraToken != null ? REDACTED : settings.jiraToken,
    gitToken:
      settings.gitToken != null ? REDACTED : settings.gitToken,
  };
}
