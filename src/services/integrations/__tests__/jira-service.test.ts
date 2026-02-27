/**
 * Jira Service tests.
 *
 * Tests for epic creation, update, and acceptance criteria extraction.
 * Uses mocked global fetch for API calls.
 */

import { JiraService } from "../jira-service";
import type { IntegrationConfig } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockConfig: IntegrationConfig = {
  jiraUrl: "https://example.atlassian.net",
  jiraEmail: "user@example.com",
  jiraProject: "PRD",
  jiraToken: "jira-token-456",
};

function basicAuth(email: string, token: string): string {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JiraService", () => {
  let service: JiraService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JiraService();
    fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // extractAcceptanceCriteria
  // -------------------------------------------------------------------------

  describe("extractAcceptanceCriteria", () => {
    it("should extract acceptance criteria section from markdown", () => {
      const md = `# PRD Title

## Overview
Some overview text.

## Acceptance Criteria
- [ ] User can log in with email
- [ ] Password must be at least 8 characters
- [ ] Session expires after 30 minutes

## Timeline
Q1 2026
`;
      const result = service.extractAcceptanceCriteria(md);

      expect(result).toContain("User can log in with email");
      expect(result).toContain("Password must be at least 8 characters");
      expect(result).toContain("Session expires after 30 minutes");
      expect(result).not.toContain("Overview");
      expect(result).not.toContain("Timeline");
    });

    it("should return empty string when no acceptance criteria found", () => {
      const md = "# PRD Title\n\n## Overview\nSome text.";
      const result = service.extractAcceptanceCriteria(md);

      expect(result).toBe("");
    });

    it("should handle case-insensitive heading match", () => {
      const md = `## acceptance criteria\n- Criterion one\n- Criterion two\n\n## Next`;
      const result = service.extractAcceptanceCriteria(md);

      expect(result).toContain("Criterion one");
      expect(result).toContain("Criterion two");
    });
  });

  // -------------------------------------------------------------------------
  // createEpic
  // -------------------------------------------------------------------------

  describe("createEpic", () => {
    it("should POST to Jira REST API with correct body", async () => {
      const responseBody = {
        id: "10001",
        key: "PRD-42",
        self: "https://example.atlassian.net/rest/api/3/issue/10001",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(responseBody), { status: 201 }),
      );

      const result = await service.createEpic(
        "User Authentication",
        "- [ ] Login works\n- [ ] Logout works",
        "https://example.atlassian.net/wiki/spaces/DEV/pages/12345",
        mockConfig,
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toBe(
        "https://example.atlassian.net/rest/api/3/issue",
      );
      expect(options.method).toBe("POST");
      expect(options.headers["Authorization"]).toBe(
        basicAuth("user@example.com", "jira-token-456"),
      );

      const body = JSON.parse(options.body);
      expect(body.fields.project.key).toBe("PRD");
      expect(body.fields.summary).toBe("User Authentication");
      expect(body.fields.issuetype.name).toBe("Epic");
      expect(body.fields.description.content).toBeDefined();

      expect(result.epicKey).toBe("PRD-42");
      expect(result.url).toContain("PRD-42");
    });

    it("should create epic without confluence URL", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "10002", key: "PRD-43", self: "" }),
          { status: 201 },
        ),
      );

      const result = await service.createEpic(
        "Feature X",
        "- [ ] Criterion",
        undefined,
        mockConfig,
      );

      expect(result.epicKey).toBe("PRD-43");
    });

    it("should throw on API error", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ errorMessages: ["Forbidden"] }), {
          status: 403,
        }),
      );

      await expect(
        service.createEpic("Test", "criteria", undefined, mockConfig),
      ).rejects.toThrow("Jira API error");
    });
  });

  // -------------------------------------------------------------------------
  // updateEpic
  // -------------------------------------------------------------------------

  describe("updateEpic", () => {
    it("should PUT to update an existing epic", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      await service.updateEpic(
        "PRD-42",
        "Updated Title",
        "- [ ] Updated criteria",
        "https://confluence.example.com/page",
        mockConfig,
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toBe(
        "https://example.atlassian.net/rest/api/3/issue/PRD-42",
      );
      expect(options.method).toBe("PUT");

      const body = JSON.parse(options.body);
      expect(body.fields.summary).toBe("Updated Title");
    });
  });
});
