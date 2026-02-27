/**
 * Beads Service tests.
 *
 * Tests for issue creation via the bd CLI.
 * Uses mocked child_process exec.
 */

jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

import { exec } from "child_process";
import { BeadsService } from "../beads-service";
import type { IntegrationConfig } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockExec = exec as unknown as jest.Mock;

const mockConfig: IntegrationConfig = {
  beadsProject: "pi-dev",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BeadsService", () => {
  let service: BeadsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BeadsService();
  });

  describe("createIssue", () => {
    it("should call bd create with correct arguments", async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
        ) => {
          callback(null, {
            stdout: "Created issue: BEAD-001\n",
            stderr: "",
          });
        },
      );

      const result = await service.createIssue(
        "New Feature PRD",
        undefined,
        undefined,
        mockConfig,
      );

      expect(mockExec).toHaveBeenCalledTimes(1);
      const cmdArg = mockExec.mock.calls[0][0];
      expect(cmdArg).toContain("bd create");
      expect(cmdArg).toContain("New Feature PRD");
      expect(cmdArg).toContain("--project pi-dev");

      expect(result.issueId).toBe("BEAD-001");
    });

    it("should include confluence URL link when provided", async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
        ) => {
          callback(null, {
            stdout: "Created issue: BEAD-002\n",
            stderr: "",
          });
        },
      );

      await service.createIssue(
        "Feature with Docs",
        "https://confluence.example.com/page/123",
        undefined,
        mockConfig,
      );

      const cmdArg = mockExec.mock.calls[0][0];
      expect(cmdArg).toContain("--link");
      expect(cmdArg).toContain("https://confluence.example.com/page/123");
    });

    it("should include Jira key link when provided", async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
        ) => {
          callback(null, {
            stdout: "Created issue: BEAD-003\n",
            stderr: "",
          });
        },
      );

      await service.createIssue(
        "Feature with Jira",
        undefined,
        "PRD-42",
        mockConfig,
      );

      const cmdArg = mockExec.mock.calls[0][0];
      expect(cmdArg).toContain("--link");
      expect(cmdArg).toContain("PRD-42");
    });

    it("should throw on exec error", async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: Error | null, result: { stdout: string; stderr: string } | null) => void,
        ) => {
          callback(new Error("Command not found: bd"), null);
        },
      );

      await expect(
        service.createIssue("Test", undefined, undefined, mockConfig),
      ).rejects.toThrow("Beads CLI error");
    });

    it("should throw when issue ID cannot be parsed from output", async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
        ) => {
          callback(null, {
            stdout: "Unexpected output\n",
            stderr: "",
          });
        },
      );

      await expect(
        service.createIssue("Test", undefined, undefined, mockConfig),
      ).rejects.toThrow("parse issue ID");
    });
  });
});
