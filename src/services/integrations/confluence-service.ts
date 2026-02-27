/**
 * Confluence Service.
 *
 * Converts Markdown to Confluence storage format (XHTML) and manages
 * Confluence pages via the REST API v2.
 */

import MarkdownIt from "markdown-it";
import type { IntegrationConfig, ConfluencePageResult } from "./types";

export class ConfluenceService {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({ html: true });
    this.applyConfluenceRenderer();
  }

  /**
   * Override the default fence renderer to produce Confluence code macros.
   */
  private applyConfluenceRenderer(): void {
    this.md.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx];
      const language = token.info.trim();
      const content = this.escapeXml(token.content);

      const langParam = language
        ? `<ac:parameter ac:name="language">${language}</ac:parameter>`
        : "";

      return (
        `<ac:structured-macro ac:name="code">` +
        langParam +
        `<ac:plain-text-body><![CDATA[${content}]]></ac:plain-text-body>` +
        `</ac:structured-macro>\n`
      );
    };
  }

  /**
   * Convert Markdown to Confluence storage format (XHTML).
   *
   * Code blocks are rendered as Confluence structured macros.
   * All other elements are standard XHTML which Confluence accepts natively.
   */
  convertMarkdown(markdown: string): string {
    return this.md.render(markdown);
  }

  /**
   * Create a new Confluence page.
   *
   * @param title - Page title
   * @param markdownContent - Markdown content to convert and publish
   * @param config - Integration configuration with Confluence credentials
   * @returns Page result with ID, URL, title, and version
   */
  async createPage(
    title: string,
    markdownContent: string,
    config: IntegrationConfig,
  ): Promise<ConfluencePageResult> {
    const storageContent = this.convertMarkdown(markdownContent);
    const baseUrl = config.confluenceUrl!;

    const response = await fetch(`${baseUrl}/api/v2/pages`, {
      method: "POST",
      headers: this.buildHeaders(config),
      body: JSON.stringify({
        title,
        spaceId: config.confluenceSpace,
        status: "current",
        body: {
          representation: "storage",
          value: storageContent,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Confluence API error (${response.status}): ${JSON.stringify(error)}`,
      );
    }

    const data = await response.json();
    return {
      pageId: data.id,
      url: `${baseUrl}${data._links.webui}`,
      title: data.title,
      version: data.version.number,
    };
  }

  /**
   * Update an existing Confluence page.
   *
   * Fetches the current version number, then PUTs with an incremented version.
   *
   * @param pageId - The Confluence page ID to update
   * @param title - Updated page title
   * @param markdownContent - Updated Markdown content
   * @param config - Integration configuration
   * @returns Updated page result
   */
  async updatePage(
    pageId: string,
    title: string,
    markdownContent: string,
    config: IntegrationConfig,
  ): Promise<ConfluencePageResult> {
    const baseUrl = config.confluenceUrl!;
    const headers = this.buildHeaders(config);

    // GET current version
    const getResponse = await fetch(`${baseUrl}/api/v2/pages/${pageId}`, {
      method: "GET",
      headers,
    });

    if (!getResponse.ok) {
      const error = await getResponse.json();
      throw new Error(
        `Confluence API error (${getResponse.status}): ${JSON.stringify(error)}`,
      );
    }

    const currentPage = await getResponse.json();
    const nextVersion = currentPage.version.number + 1;

    // PUT with incremented version
    const storageContent = this.convertMarkdown(markdownContent);

    const putResponse = await fetch(`${baseUrl}/api/v2/pages/${pageId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        id: pageId,
        title,
        status: "current",
        version: { number: nextVersion },
        body: {
          representation: "storage",
          value: storageContent,
        },
      }),
    });

    if (!putResponse.ok) {
      const error = await putResponse.json();
      throw new Error(
        `Confluence API error (${putResponse.status}): ${JSON.stringify(error)}`,
      );
    }

    const data = await putResponse.json();
    return {
      pageId: data.id,
      url: `${baseUrl}${data._links.webui}`,
      title: data.title,
      version: data.version.number,
    };
  }

  private buildHeaders(config: IntegrationConfig): Record<string, string> {
    const credentials = Buffer.from(
      `${config.confluenceEmail}:${config.confluenceToken}`,
    ).toString("base64");

    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    };
  }

  private escapeXml(str: string): string {
    // Inside CDATA we only need to avoid the ]]> sequence
    return str.replace(/]]>/g, "]]]]><![CDATA[>");
  }
}
