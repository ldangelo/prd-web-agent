/**
 * Jira Service.
 *
 * Manages Jira epics via the REST API v3 for the submission pipeline.
 * Includes extraction of acceptance criteria from PRD markdown content.
 */

import type { IntegrationConfig, JiraEpicResult } from "./types";

export class JiraService {
  /**
   * Extract the Acceptance Criteria section from PRD markdown.
   *
   * Looks for a heading containing "acceptance criteria" (case-insensitive)
   * and returns everything until the next heading of equal or higher level.
   *
   * @param markdownContent - Full PRD markdown
   * @returns Extracted acceptance criteria text, or empty string if not found
   */
  extractAcceptanceCriteria(markdownContent: string): string {
    const lines = markdownContent.split("\n");
    let capturing = false;
    let capturedLines: string[] = [];
    let headingLevel = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();

        if (text.toLowerCase().includes("acceptance criteria")) {
          capturing = true;
          headingLevel = level;
          continue;
        }

        // Stop capturing at next heading of same or higher level
        if (capturing && level <= headingLevel) {
          break;
        }
      }

      if (capturing) {
        capturedLines.push(line);
      }
    }

    return capturedLines.join("\n").trim();
  }

  /**
   * Create a Jira epic.
   *
   * @param title - Epic summary/title
   * @param acceptanceCriteria - Acceptance criteria text
   * @param confluenceUrl - Optional link to Confluence page
   * @param config - Integration configuration
   * @returns Epic result with key and URL
   */
  async createEpic(
    title: string,
    acceptanceCriteria: string,
    confluenceUrl: string | undefined,
    config: IntegrationConfig,
  ): Promise<JiraEpicResult> {
    const baseUrl = config.jiraUrl!;

    const descriptionContent: unknown[] = [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: acceptanceCriteria,
          },
        ],
      },
    ];

    if (confluenceUrl) {
      descriptionContent.push({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Confluence: ",
          },
          {
            type: "text",
            text: confluenceUrl,
            marks: [{ type: "link", attrs: { href: confluenceUrl } }],
          },
        ],
      });
    }

    const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: this.buildHeaders(config),
      body: JSON.stringify({
        fields: {
          project: { key: config.jiraProject },
          summary: title,
          issuetype: { name: "Epic" },
          description: {
            type: "doc",
            version: 1,
            content: descriptionContent,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Jira API error (${response.status}): ${JSON.stringify(error)}`,
      );
    }

    const data = await response.json();
    return {
      epicKey: data.key,
      url: `${baseUrl}/browse/${data.key}`,
      title,
    };
  }

  /**
   * Update an existing Jira epic.
   *
   * @param epicKey - The Jira issue key (e.g. "PRD-42")
   * @param title - Updated summary
   * @param acceptanceCriteria - Updated acceptance criteria
   * @param confluenceUrl - Optional Confluence link
   * @param config - Integration configuration
   */
  async updateEpic(
    epicKey: string,
    title: string,
    acceptanceCriteria: string,
    confluenceUrl: string | undefined,
    config: IntegrationConfig,
  ): Promise<void> {
    const baseUrl = config.jiraUrl!;

    const descriptionContent: unknown[] = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: acceptanceCriteria },
        ],
      },
    ];

    if (confluenceUrl) {
      descriptionContent.push({
        type: "paragraph",
        content: [
          { type: "text", text: "Confluence: " },
          {
            type: "text",
            text: confluenceUrl,
            marks: [{ type: "link", attrs: { href: confluenceUrl } }],
          },
        ],
      });
    }

    const response = await fetch(`${baseUrl}/rest/api/3/issue/${epicKey}`, {
      method: "PUT",
      headers: this.buildHeaders(config),
      body: JSON.stringify({
        fields: {
          summary: title,
          description: {
            type: "doc",
            version: 1,
            content: descriptionContent,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Jira API error (${response.status}): ${JSON.stringify(error)}`,
      );
    }
  }

  private buildHeaders(config: IntegrationConfig): Record<string, string> {
    const credentials = Buffer.from(
      `${config.jiraEmail}:${config.jiraToken}`,
    ).toString("base64");

    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    };
  }
}
