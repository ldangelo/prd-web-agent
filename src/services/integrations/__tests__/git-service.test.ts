/**
 * Git Service tests.
 *
 * Tests for PR creation via GitHub REST API.
 * Uses mocked global fetch for all API calls.
 */

import { GitService } from "../git-service";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GitService", () => {
  let service: GitService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GitService();
    fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("createPr", () => {
    it("should make correct API calls to create branch, commit, and open PR", async () => {
      // 1. GET default branch ref (get SHA)
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            object: { sha: "abc123def456" },
          }),
          { status: 200 },
        ),
      );

      // 2. POST create branch ref
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ref: "refs/heads/prd/test-branch" }),
          { status: 201 },
        ),
      );

      // 3. PUT create/update file (commit)
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: { sha: "file-sha-789" },
            commit: { sha: "commit-sha-xyz" },
          }),
          { status: 201 },
        ),
      );

      // 4. POST create pull request
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            number: 42,
            html_url: "https://github.com/owner/repo/pull/42",
          }),
          { status: 201 },
        ),
      );

      const result = await service.createPr({
        repo: "owner/repo",
        branch: "prd/test-branch",
        filePath: "docs/prd-001.md",
        content: "# PRD Content",
        title: "Add PRD-001",
        description: "New PRD document",
        token: "ghp_test-token",
      });

      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // Verify GET default branch SHA
      const [getUrl, getOpts] = fetchSpy.mock.calls[0];
      expect(getUrl).toBe(
        "https://api.github.com/repos/owner/repo/git/ref/heads/main",
      );
      expect(getOpts.headers["Authorization"]).toBe("Bearer ghp_test-token");

      // Verify POST create branch
      const [branchUrl, branchOpts] = fetchSpy.mock.calls[1];
      expect(branchUrl).toBe(
        "https://api.github.com/repos/owner/repo/git/refs",
      );
      expect(branchOpts.method).toBe("POST");
      const branchBody = JSON.parse(branchOpts.body);
      expect(branchBody.ref).toBe("refs/heads/prd/test-branch");
      expect(branchBody.sha).toBe("abc123def456");

      // Verify PUT file content
      const [fileUrl, fileOpts] = fetchSpy.mock.calls[2];
      expect(fileUrl).toBe(
        "https://api.github.com/repos/owner/repo/contents/docs/prd-001.md",
      );
      expect(fileOpts.method).toBe("PUT");
      const fileBody = JSON.parse(fileOpts.body);
      expect(fileBody.branch).toBe("prd/test-branch");
      expect(fileBody.message).toContain("Add PRD-001");

      // Verify POST create PR
      const [prUrl, prOpts] = fetchSpy.mock.calls[3];
      expect(prUrl).toBe(
        "https://api.github.com/repos/owner/repo/pulls",
      );
      expect(prOpts.method).toBe("POST");
      const prBody = JSON.parse(prOpts.body);
      expect(prBody.title).toBe("Add PRD-001");
      expect(prBody.head).toBe("prd/test-branch");
      expect(prBody.base).toBe("main");

      // Verify result
      expect(result.prUrl).toBe("https://github.com/owner/repo/pull/42");
      expect(result.prNumber).toBe(42);
      expect(result.branch).toBe("prd/test-branch");
    });

    it("should throw on GitHub API error", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: "Not Found" }),
          { status: 404 },
        ),
      );

      await expect(
        service.createPr({
          repo: "owner/repo",
          branch: "prd/test",
          filePath: "docs/test.md",
          content: "# Test",
          title: "Test PR",
          description: "Test",
          token: "ghp_bad-token",
        }),
      ).rejects.toThrow("GitHub API error");
    });
  });
});
