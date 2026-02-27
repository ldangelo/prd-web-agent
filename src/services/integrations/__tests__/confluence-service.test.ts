/**
 * Confluence Service tests.
 *
 * Tests for Markdown-to-Confluence conversion, page creation, and page updates.
 * Uses mocked global fetch for API calls.
 */

import { ConfluenceService } from "../confluence-service";
import type { IntegrationConfig } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockConfig: IntegrationConfig = {
  confluenceUrl: "https://example.atlassian.net/wiki",
  confluenceEmail: "user@example.com",
  confluenceSpace: "DEV",
  confluenceToken: "test-token-123",
};

function basicAuth(email: string, token: string): string {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConfluenceService", () => {
  let service: ConfluenceService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConfluenceService();
    fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // convertMarkdown
  // -------------------------------------------------------------------------

  describe("convertMarkdown", () => {
    it("should convert headings to XHTML", () => {
      const md = "# Heading 1\n\n## Heading 2\n\n### Heading 3";
      const result = service.convertMarkdown(md);

      expect(result).toContain("<h1>");
      expect(result).toContain("Heading 1");
      expect(result).toContain("<h2>");
      expect(result).toContain("Heading 2");
      expect(result).toContain("<h3>");
      expect(result).toContain("Heading 3");
    });

    it("should convert code blocks to Confluence structured macro", () => {
      const md = "```typescript\nconst x = 1;\n```";
      const result = service.convertMarkdown(md);

      expect(result).toContain('ac:name="code"');
      expect(result).toContain("ac:parameter");
      expect(result).toContain("typescript");
      expect(result).toContain("const x = 1;");
    });

    it("should convert code blocks without language", () => {
      const md = "```\nplain code\n```";
      const result = service.convertMarkdown(md);

      expect(result).toContain('ac:name="code"');
      expect(result).toContain("plain code");
    });

    it("should convert tables to XHTML", () => {
      const md = "| Col A | Col B |\n|-------|-------|\n| 1     | 2     |";
      const result = service.convertMarkdown(md);

      expect(result).toContain("<table>");
      expect(result).toContain("<th>");
      expect(result).toContain("<td>");
      expect(result).toContain("Col A");
      expect(result).toContain("1");
    });

    it("should convert unordered lists", () => {
      const md = "- item one\n- item two";
      const result = service.convertMarkdown(md);

      expect(result).toContain("<ul>");
      expect(result).toContain("<li>");
      expect(result).toContain("item one");
    });

    it("should convert ordered lists", () => {
      const md = "1. first\n2. second";
      const result = service.convertMarkdown(md);

      expect(result).toContain("<ol>");
      expect(result).toContain("<li>");
      expect(result).toContain("first");
    });

    it("should handle bold and italic text", () => {
      const md = "**bold** and *italic*";
      const result = service.convertMarkdown(md);

      expect(result).toContain("<strong>bold</strong>");
      expect(result).toContain("<em>italic</em>");
    });
  });

  // -------------------------------------------------------------------------
  // createPage
  // -------------------------------------------------------------------------

  describe("createPage", () => {
    it("should POST to Confluence REST API with correct body", async () => {
      const responseBody = {
        id: "12345",
        title: "Test Page",
        version: { number: 1 },
        _links: { webui: "/spaces/DEV/pages/12345/Test+Page" },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(responseBody), { status: 200 }),
      );

      const result = await service.createPage(
        "Test Page",
        "# Hello World",
        mockConfig,
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toBe(
        "https://example.atlassian.net/wiki/api/v2/pages",
      );
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers["Authorization"]).toBe(
        basicAuth("user@example.com", "test-token-123"),
      );

      const body = JSON.parse(options.body);
      expect(body.title).toBe("Test Page");
      expect(body.spaceId).toBe("DEV");
      expect(body.body.representation).toBe("storage");
      expect(body.body.value).toContain("Hello World");

      expect(result.pageId).toBe("12345");
      expect(result.title).toBe("Test Page");
      expect(result.url).toContain("/spaces/DEV/pages/12345");
    });

    it("should throw on API error", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
        }),
      );

      await expect(
        service.createPage("Test", "# Test", mockConfig),
      ).rejects.toThrow("Confluence API error");
    });
  });

  // -------------------------------------------------------------------------
  // updatePage
  // -------------------------------------------------------------------------

  describe("updatePage", () => {
    it("should GET current version and PUT with incremented version", async () => {
      // First call: GET current page
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "12345",
            title: "Existing Page",
            version: { number: 3 },
            _links: { webui: "/spaces/DEV/pages/12345/Existing+Page" },
          }),
          { status: 200 },
        ),
      );

      // Second call: PUT update
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "12345",
            title: "Updated Page",
            version: { number: 4 },
            _links: { webui: "/spaces/DEV/pages/12345/Updated+Page" },
          }),
          { status: 200 },
        ),
      );

      const result = await service.updatePage(
        "12345",
        "Updated Page",
        "# Updated Content",
        mockConfig,
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Verify GET
      const [getUrl, getOptions] = fetchSpy.mock.calls[0];
      expect(getUrl).toBe(
        "https://example.atlassian.net/wiki/api/v2/pages/12345",
      );
      expect(getOptions.method).toBe("GET");

      // Verify PUT
      const [putUrl, putOptions] = fetchSpy.mock.calls[1];
      expect(putUrl).toBe(
        "https://example.atlassian.net/wiki/api/v2/pages/12345",
      );
      expect(putOptions.method).toBe("PUT");

      const putBody = JSON.parse(putOptions.body);
      expect(putBody.version.number).toBe(4);
      expect(putBody.title).toBe("Updated Page");
      expect(putBody.body.value).toContain("Updated Content");

      expect(result.version).toBe(4);
    });
  });
});
