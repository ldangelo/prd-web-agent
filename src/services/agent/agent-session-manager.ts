/**
 * AgentSessionManager
 *
 * Manages the lifecycle of in-memory agent sessions including creation,
 * prompt forwarding, event subscription, idle eviction, and cleanup.
 */

import type { AgentSession, AgentSessionEvent } from "@/types/pi-sdk";
import { createAgentSession } from "@/types/pi-sdk";
import { createPiSession, isPiSdkAvailable } from "./pi-sdk-init";
import { createResourceLoader } from "./resource-loader";
import { buildSystemPrompt } from "./system-prompt";
import { createAgentTools } from "./tools";
import { findSessionFile } from "./session-persistence";
import { getUserLlmConfig } from "@/services/llm-config-service";
import type { LlmConfig } from "@/services/llm-config-service";
import logger from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManagedSession {
  session: AgentSession;
  userId: string;
  projectId: string;
  prdId?: string;
  llmConfig?: LlmConfig;
  idleTimer: ReturnType<typeof setTimeout>;
  lastActivity: number;
}

export interface CreateSessionOpts {
  userId: string;
  mode: "create" | "refine";
  projectId: string;
  prdId?: string;
  prdContent?: string;
  description?: string;
  workingDir?: string;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class AgentSessionManager {
  private sessions: Map<string, ManagedSession> = new Map();
  private readonly IDLE_TIMEOUT_MS: number;

  constructor(idleTimeoutMs?: number) {
    // Default: 2 hours. Allow override for testing.
    this.IDLE_TIMEOUT_MS = idleTimeoutMs ?? 2 * 60 * 60 * 1000;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create a new agent session.
   */
  async createSession(opts: CreateSessionOpts): Promise<{ sessionId: string }> {
    const userLlmConfig = await getUserLlmConfig(opts.userId);
    const llmConfig: LlmConfig = {
      provider: userLlmConfig.provider,
      model: userLlmConfig.model,
      thinkingLevel: userLlmConfig.thinkingLevel,
    };

    // Try to use the real Pi SDK first
    let session: AgentSession | null = null;

    if (await isPiSdkAvailable()) {
      const systemPrompt = buildSystemPrompt({
        mode: opts.mode,
        prdContent: opts.prdContent,
        projectDescription: opts.description,
      });
      const customTools = createAgentTools(opts.userId, opts.projectId, opts.prdId);

      session = await createPiSession({
        llmConfig,
        customTools,
        systemPrompt,
        workingDir: opts.workingDir,
        apiKey: userLlmConfig.apiKey,
        providerForAuth: userLlmConfig.provider,
      });
    }

    // Fall back to the stub factory
    if (!session) {
      const resourceLoader = createResourceLoader({
        mode: opts.mode,
        prdContent: opts.prdContent,
        projectDescription: opts.description,
      });
      session = await createAgentSession({ resourceLoader });
    }

    const managed: ManagedSession = {
      session,
      userId: opts.userId,
      projectId: opts.projectId,
      prdId: opts.prdId,
      llmConfig,
      idleTimer: this.startIdleTimer(session.sessionId),
      lastActivity: Date.now(),
    };

    this.sessions.set(session.sessionId, managed);

    logger.info(
      {
        sessionId: session.sessionId,
        userId: opts.userId,
        llmProvider: llmConfig.provider,
        llmModel: llmConfig.model,
      },
      "Agent session created",
    );

    return { sessionId: session.sessionId };
  }

  /**
   * Resume a previously persisted session from its EFS file.
   */
  async resumeSession(
    sessionId: string,
    userId: string,
  ): Promise<{ sessionId: string }> {
    const filePath = await findSessionFile(sessionId, userId);
    if (!filePath) {
      throw new Error(
        `Session file not found for session=${sessionId} user=${userId}`,
      );
    }

    const resourceLoader = createResourceLoader({ mode: "refine" });
    const session = await createAgentSession({
      resourceLoader,
      sessionFilePath: filePath,
    });

    const managed: ManagedSession = {
      session,
      userId,
      projectId: "", // will be populated from persisted metadata
      idleTimer: this.startIdleTimer(session.sessionId),
      lastActivity: Date.now(),
    };

    this.sessions.set(session.sessionId, managed);

    logger.info(
      { sessionId: session.sessionId, userId },
      "Agent session resumed",
    );

    return { sessionId: session.sessionId };
  }

  /**
   * Send a prompt to an active session.
   */
  async prompt(
    sessionId: string,
    text: string,
    images?: unknown[],
  ): Promise<void> {
    const managed = this.getManaged(sessionId);
    this.resetIdleTimer(sessionId);
    await managed.session.prompt(text, images ? { images } : undefined);
  }

  /**
   * Subscribe to events from an active session.
   * Returns an unsubscribe function.
   */
  subscribe(
    sessionId: string,
    listener: (event: AgentSessionEvent) => void,
  ): () => void {
    const managed = this.getManaged(sessionId);
    return managed.session.subscribe(listener);
  }

  /**
   * Number of sessions currently held in memory.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Dispose all sessions. Should be called on graceful shutdown.
   */
  async disposeAll(): Promise<void> {
    for (const [id, managed] of this.sessions) {
      clearTimeout(managed.idleTimer);
      try {
        managed.session.dispose();
      } catch (err) {
        logger.warn({ sessionId: id, err }, "Error disposing session");
      }
    }
    this.sessions.clear();
    logger.info("All agent sessions disposed");
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private getManaged(sessionId: string): ManagedSession {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      throw new Error(`No active session found: ${sessionId}`);
    }
    return managed;
  }

  private startIdleTimer(sessionId: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      void this.evictSession(sessionId);
    }, this.IDLE_TIMEOUT_MS);
  }

  private resetIdleTimer(sessionId: string): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;
    clearTimeout(managed.idleTimer);
    managed.lastActivity = Date.now();
    managed.idleTimer = this.startIdleTimer(sessionId);
  }

  private async evictSession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;

    logger.info(
      { sessionId, userId: managed.userId },
      "Evicting idle agent session",
    );

    clearTimeout(managed.idleTimer);
    try {
      managed.session.dispose();
    } catch (err) {
      logger.warn({ sessionId, err }, "Error during session eviction");
    }
    this.sessions.delete(sessionId);
  }
}
