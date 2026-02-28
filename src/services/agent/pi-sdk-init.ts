/**
 * Pi SDK initialization module.
 *
 * Lazy-initializes the Pi coding agent SDK and provides a factory
 * function to create real agent sessions using the SDK's in-memory
 * session and settings managers.
 */

import type { AgentSession, AgentSessionEvent, ToolDefinition } from "@/types/pi-sdk";
import type { LlmConfig } from "@/services/llm-config-service";
import logger from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatePiSessionOptions {
  llmConfig: LlmConfig;
  customTools: ToolDefinition[];
  systemPrompt: string;
  workingDir?: string;
  apiKey?: string;
  providerForAuth?: string;
}

// ---------------------------------------------------------------------------
// Lazy SDK import helpers
// ---------------------------------------------------------------------------

let _sdkLoaded = false;
let _SessionManager: any;
let _SettingsManager: any;
let _AuthStorage: any;
let _getModel: any;

async function ensureSdkLoaded(): Promise<void> {
  if (_sdkLoaded) return;

  try {
    const piAgent = await import("@anthropic-ai/claude-code-sdk-agent");
    const piAi = await import("@anthropic-ai/claude-code-sdk-ai");

    _SessionManager = piAgent.SessionManager;
    _SettingsManager = piAgent.SettingsManager;
    _AuthStorage = piAi.AuthStorage;
    _getModel = piAi.getModel;
    _sdkLoaded = true;
  } catch {
    // Fall back to alternate package names
    try {
      const piAgent = await import("@mariozechner/pi-coding-agent");
      const piAi = await import("@mariozechner/pi-ai");

      _SessionManager = piAgent.SessionManager;
      _SettingsManager = piAgent.SettingsManager;
      _AuthStorage = piAi.AuthStorage;
      _getModel = piAi.getModel;
      _sdkLoaded = true;
    } catch (err) {
      logger.warn(
        { err },
        "Pi SDK packages not available — falling back to stub sessions",
      );
      _sdkLoaded = false;
    }
  }
}

// ---------------------------------------------------------------------------
// API key configuration
// ---------------------------------------------------------------------------

let _authConfigured = false;

async function ensureAuth(): Promise<void> {
  if (_authConfigured || !_AuthStorage) return;

  const apiKey = process.env.PI_SDK_API_KEY;
  if (apiKey) {
    try {
      const authStorage = new _AuthStorage();
      authStorage.setRuntimeApiKey("anthropic", apiKey);
      _authConfigured = true;
    } catch (err) {
      logger.warn({ err }, "Failed to configure Pi SDK auth storage");
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the real Pi SDK is available.
 */
export async function isPiSdkAvailable(): Promise<boolean> {
  await ensureSdkLoaded();
  return _sdkLoaded;
}

/**
 * Create a real Pi agent session using the SDK.
 *
 * Falls back to null if the SDK is not available (caller should
 * use the stub factory in that case).
 */
export async function createPiSession(
  opts: CreatePiSessionOptions,
): Promise<AgentSession | null> {
  await ensureSdkLoaded();

  if (!_sdkLoaded) {
    return null;
  }

  // Configure auth: prefer per-session key, fall back to global
  if (opts.apiKey && opts.providerForAuth) {
    try {
      const authStorage = new _AuthStorage();
      authStorage.setRuntimeApiKey(opts.providerForAuth, opts.apiKey);
    } catch (err) {
      logger.warn({ err }, "Failed to configure per-session Pi SDK auth");
    }
  } else {
    await ensureAuth();
  }

  try {
    const sessionManager = _SessionManager.inMemory();
    const settingsManager = _SettingsManager.inMemory();

    const model = _getModel({
      provider: opts.llmConfig.provider,
      model: opts.llmConfig.model,
    });

    const session = await sessionManager.createSession({
      model,
      tools: opts.customTools,
      systemPrompt: opts.systemPrompt,
      settings: settingsManager,
      ...(opts.workingDir ? { cwd: opts.workingDir } : {}),
    });

    const sessionId = session.id || `pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const listeners = new Set<(event: AgentSessionEvent) => void>();

    // Subscribe to the real SDK's event stream
    session.on("event", (sdkEvent: any) => {
      const mapped = mapSdkEvent(sdkEvent);
      if (mapped) {
        for (const listener of listeners) {
          listener(mapped);
        }
      }
    });

    return {
      sessionId,
      async prompt(text: string, options?: { images?: unknown[] }) {
        await session.send(text, options);
      },
      subscribe(listener: (event: AgentSessionEvent) => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      dispose() {
        listeners.clear();
        try {
          session.stop?.();
        } catch {
          // Ignore dispose errors
        }
      },
    };
  } catch (err) {
    logger.error({ err }, "Failed to create Pi SDK session");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Event mapping
// ---------------------------------------------------------------------------

function mapSdkEvent(sdkEvent: any): AgentSessionEvent | null {
  if (!sdkEvent || !sdkEvent.type) return null;

  switch (sdkEvent.type) {
    case "message_update":
      if (sdkEvent.assistantMessageEvent?.type === "content_block_delta") {
        return {
          type: "text_delta",
          data: sdkEvent.assistantMessageEvent.delta ?? "",
        };
      }
      if (sdkEvent.assistantMessageEvent?.type === "message_start") {
        return { type: "message_start" };
      }
      if (sdkEvent.assistantMessageEvent?.type === "message_stop") {
        return { type: "message_end" };
      }
      return null;

    case "tool_execution_start":
      return {
        type: "tool_start",
        data: { toolName: sdkEvent.toolName ?? "unknown" },
      };

    case "tool_execution_end":
      return {
        type: "tool_end",
        data: {
          toolName: sdkEvent.toolName ?? "unknown",
          isError: sdkEvent.isError ?? false,
        },
      };

    case "agent_end":
    case "turn_end":
      return { type: "message_end" };

    case "error":
      return { type: "error", data: sdkEvent.message ?? "Unknown SDK error" };

    default:
      return null;
  }
}
