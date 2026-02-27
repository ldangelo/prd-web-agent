/**
 * LLM Config Service tests.
 *
 * Tests for reading LLM configuration from GlobalSettings with
 * fallback to defaults when no settings row exists.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockGlobalSettingsFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    globalSettings: {
      findUnique: (...args: unknown[]) => mockGlobalSettingsFindUnique(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getLlmConfig } from "../llm-config-service";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_GLOBAL_SETTINGS = {
  id: "global",
  llmProvider: "anthropic",
  llmModel: "claude-sonnet-4-20250514",
  llmThinkingLevel: "medium",
  confluenceSpace: "SPACE",
  jiraProject: "PROJ",
  gitRepo: "org/repo",
  beadsProject: "beads",
  blockApprovalOnUnresolvedComments: true,
  confluenceToken: null,
  jiraToken: null,
  gitToken: null,
  updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LlmConfigService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLlmConfig", () => {
    it("should return LLM settings from the database", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue(MOCK_GLOBAL_SETTINGS);

      const config = await getLlmConfig();

      expect(config).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        thinkingLevel: "medium",
      });
      expect(mockGlobalSettingsFindUnique).toHaveBeenCalledWith({
        where: { id: "global" },
      });
    });

    it("should return custom settings when overridden in the database", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue({
        ...MOCK_GLOBAL_SETTINGS,
        llmProvider: "openai",
        llmModel: "gpt-4o",
        llmThinkingLevel: "high",
      });

      const config = await getLlmConfig();

      expect(config).toEqual({
        provider: "openai",
        model: "gpt-4o",
        thinkingLevel: "high",
      });
    });

    it("should return defaults when no global settings row exists", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue(null);

      const config = await getLlmConfig();

      expect(config).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        thinkingLevel: "medium",
      });
    });

    it("should return a new object each time (no shared references)", async () => {
      mockGlobalSettingsFindUnique.mockResolvedValue(null);

      const config1 = await getLlmConfig();
      const config2 = await getLlmConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });
});
