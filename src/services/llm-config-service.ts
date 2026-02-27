/**
 * LLM Config Service.
 *
 * Reads LLM configuration (provider, model, thinkingLevel) from the
 * GlobalSettings table. Falls back to sensible defaults when no row
 * exists in the database.
 */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmConfig {
  provider: string;
  model: string;
  thinkingLevel: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  thinkingLevel: "medium",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the effective LLM configuration.
 *
 * Loads the GlobalSettings row from the database. If no row exists,
 * returns hard-coded defaults so the application can always start.
 *
 * @returns The resolved LLM configuration
 */
export async function getLlmConfig(): Promise<LlmConfig> {
  const settings = await prisma.globalSettings.findUnique({
    where: { id: "global" },
  });

  if (!settings) {
    return { ...DEFAULT_LLM_CONFIG };
  }

  return {
    provider: settings.llmProvider,
    model: settings.llmModel,
    thinkingLevel: settings.llmThinkingLevel,
  };
}
