/**
 * Beads Service.
 *
 * Creates issues in the Beads system via the `bd` CLI tool.
 * Supports linking to Confluence pages and Jira epics.
 */

import { exec } from "child_process";
import type { IntegrationConfig, BeadsIssueResult } from "./types";

export class BeadsService {
  /**
   * Create a Beads issue via the bd CLI.
   *
   * @param title - Issue title
   * @param confluenceUrl - Optional Confluence page URL to link
   * @param jiraKey - Optional Jira epic key to link
   * @param config - Integration configuration
   * @returns Issue result with the created issue ID
   */
  async createIssue(
    title: string,
    confluenceUrl: string | undefined,
    jiraKey: string | undefined,
    config: IntegrationConfig,
  ): Promise<BeadsIssueResult> {
    const args: string[] = [
      "bd create",
      `--title "${this.escapeShell(title)}"`,
      `--project ${config.beadsProject}`,
    ];

    if (confluenceUrl) {
      args.push(`--link "${this.escapeShell(confluenceUrl)}"`);
    }

    if (jiraKey) {
      args.push(`--link "${this.escapeShell(jiraKey)}"`);
    }

    const command = args.join(" ");

    return new Promise<BeadsIssueResult>((resolve, reject) => {
      exec(command, (error, result) => {
        if (error) {
          reject(new Error(`Beads CLI error: ${error.message}`));
          return;
        }

        const stdout = typeof result === "string" ? result : result?.stdout ?? "";
        const issueIdMatch = stdout.match(/(?:Created issue:\s*)(\S+)/);

        if (!issueIdMatch) {
          reject(
            new Error(
              `Failed to parse issue ID from bd output: ${stdout}`,
            ),
          );
          return;
        }

        resolve({ issueId: issueIdMatch[1] });
      });
    });
  }

  private escapeShell(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}
