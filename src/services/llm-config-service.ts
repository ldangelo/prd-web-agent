/**
 * LLM Config Service.
 *
 * Reads LLM configuration (provider, model, thinkingLevel) from the
 * UserLlmSettings table (per-user) or GlobalSettings table (global fallback).
 * Falls back to sensible defaults when no row exists in the database.
 */
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmConfig {
  provider: string;
  model: string;
  thinkingLevel: string;
}

export interface UserLlmConfig extends LlmConfig {
  apiKey: string;
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

/**
 * Retrieve the effective LLM configuration for a specific user.
 *
 * Checks for per-user settings first. If the user has saved their own
 * provider/model/apiKey, those are returned (with the key decrypted).
 * Otherwise falls back to the global config + PI_SDK_API_KEY env var.
 */
export async function getUserLlmConfig(
  userId: string,
): Promise<UserLlmConfig> {
  const userSettings = await prisma.userLlmSettings.findUnique({
    where: { userId },
  });

  if (userSettings) {
    return {
      provider: userSettings.provider,
      model: userSettings.model,
      thinkingLevel: "medium",
      apiKey: decryptApiKey(userSettings.apiKey),
    };
  }

  // Fall back to global config + env var
  const globalConfig = await getLlmConfig();
  return {
    ...globalConfig,
    apiKey: process.env.PI_SDK_API_KEY || "",
  };
}
