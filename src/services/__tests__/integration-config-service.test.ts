/**
 * Integration Config Service tests.
 *
 * Tests for resolving integration configuration by merging
 * global settings with project-level overrides, and for
 * token redaction in API responses.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockGlobalSettingsFindUnique = jest.fn();
const mockProjectFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    globalSettings: {
      findUnique: (...args: unknown[]) => mockGlobalSettingsFindUnique(...args),
    },
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  resolveIntegrationConfig,
  redactTokens,
} from "../integration-config-service";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_GLOBAL_SETTINGS = {
  id: "global",
  confluenceSpace: "GLOBAL_SPACE",
  jiraProject: "GLOBAL_PROJ",
  gitRepo: "org/global-repo",
  beadsProject: "global-beads",
  confluenceToken: "secret-confluence-token",
  jiraToken: "secret-jira-token",
  gitToken: "secret-git-token",
  llmProvider: "anthropic",
  llmModel: "claude-sonnet-4-20250514",
  llmThinkingLevel: "medium",
  blockApprovalOnUnresolvedComments: true,
  updatedAt: new Date("2026-01-01"),
};

const MOCK_PROJECT = {
  id: "proj_001",
  name: "Test Project",
  confluenceSpace: null,
  jiraProject: "PROJ_OVERRIDE",
  gitRepo: null,
  beadsProject: "proj-beads-override",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IntegrationConfigService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // resolveIntegrationConfig
  // -----------------------------------------------------------------------

  describe("resolveIntegrationConfig", () => {
    it("should return global settings when no project overrides exist", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue(MOCK_GLOBAL_SETTINGS);
      mockProjectFindUnique.mockResolvedValue({
        ...MOCK_PROJECT,
        confluenceSpace: null,
        jiraProject: null,
        gitRepo: null,
        beadsProject: null,
      });

      const config = await resolveIntegrationConfig("proj_001");

      expect(config.confluenceSpace).toBe("GLOBAL_SPACE");
      expect(config.jiraProject).toBe("GLOBAL_PROJ");
      expect(config.gitRepo).toBe("org/global-repo");
      expect(config.beadsProject).toBe("global-beads");
      expect(config.confluenceToken).toBe("secret-confluence-token");
      expect(config.jiraToken).toBe("secret-jira-token");
      expect(config.gitToken).toBe("secret-git-token");
    });

    it("should use project overrides when they exist", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue(MOCK_GLOBAL_SETTINGS);
      mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);

      const config = await resolveIntegrationConfig("proj_001");

      // Project overrides
      expect(config.jiraProject).toBe("PROJ_OVERRIDE");
      expect(config.beadsProject).toBe("proj-beads-override");

      // Global defaults (project values are null)
      expect(config.confluenceSpace).toBe("GLOBAL_SPACE");
      expect(config.gitRepo).toBe("org/global-repo");
    });

    it("should return empty config when no global settings exist", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue(null);
      mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);

      const config = await resolveIntegrationConfig("proj_001");

      // Project overrides still apply
      expect(config.jiraProject).toBe("PROJ_OVERRIDE");
      expect(config.beadsProject).toBe("proj-beads-override");

      // No global fallback
      expect(config.confluenceSpace).toBeUndefined();
      expect(config.confluenceToken).toBeUndefined();
    });

    it("should return empty config when project not found", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue(MOCK_GLOBAL_SETTINGS);
      mockProjectFindUnique.mockResolvedValue(null);

      const config = await resolveIntegrationConfig("proj_999");

      // Global values only
      expect(config.confluenceSpace).toBe("GLOBAL_SPACE");
      expect(config.jiraProject).toBe("GLOBAL_PROJ");
      expect(config.gitRepo).toBe("org/global-repo");
    });
  });

  // -----------------------------------------------------------------------
  // redactTokens
  // -----------------------------------------------------------------------

  describe("redactTokens", () => {
    it("should replace token values with redacted placeholder", () => {
      const settings = { ...MOCK_GLOBAL_SETTINGS };
      const redacted = redactTokens(settings);

      expect(redacted.confluenceToken).toBe("••••••••");
      expect(redacted.jiraToken).toBe("••••••••");
      expect(redacted.gitToken).toBe("••••••••");
    });

    it("should leave null tokens as null", () => {
      const settings = {
        ...MOCK_GLOBAL_SETTINGS,
        confluenceToken: null,
        jiraToken: null,
        gitToken: null,
      };
      const redacted = redactTokens(settings);

      expect(redacted.confluenceToken).toBeNull();
      expect(redacted.jiraToken).toBeNull();
      expect(redacted.gitToken).toBeNull();
    });

    it("should preserve non-token fields", () => {
      const settings = { ...MOCK_GLOBAL_SETTINGS };
      const redacted = redactTokens(settings);

      expect(redacted.confluenceSpace).toBe("GLOBAL_SPACE");
      expect(redacted.jiraProject).toBe("GLOBAL_PROJ");
      expect(redacted.llmProvider).toBe("anthropic");
    });
  });
});
