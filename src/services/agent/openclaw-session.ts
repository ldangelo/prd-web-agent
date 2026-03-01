/**
 * OpenClaw-backed AgentSession adapter.
 *
 * Implements the AgentSession interface by calling the OpenClaw Gateway
 * HTTP API. Text deltas from SSE streaming are mapped to the standard
 * agent events expected by the Socket.io forwarding layer.
 */
import type { AgentSession, AgentSessionEvent } from "@/types/pi-sdk";
import type { OpenClawClient } from "@/services/openclaw";
import logger from "@/lib/logger";

export interface OpenClawSessionOptions {
  client: OpenClawClient;
  systemPrompt: string;
  sessionKey: string;
}

class OpenClawAgentSession implements AgentSession {
  sessionId: string;
  private client: OpenClawClient;
  private messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  private listeners: Set<(event: AgentSessionEvent) => void>;
  private sessionKey: string;
  private disposed: boolean;

  constructor(opts: OpenClawSessionOptions) {
    this.sessionId = `oc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.client = opts.client;
    this.messages = [{ role: "system", content: opts.systemPrompt }];
    this.listeners = new Set();
    this.sessionKey = opts.sessionKey;
    this.disposed = false;
  }

  async prompt(text: string, _options?: { images?: unknown[] }): Promise<void> {
    if (this.disposed) throw new Error("Session disposed");

    this.messages.push({ role: "user", content: text });
    this.emit({ type: "message_start" });

    try {
      const fullResponse = await this.client.chat({
        messages: [...this.messages],
        sessionKey: this.sessionKey,
        onDelta: (delta) => {
          this.emit({ type: "text_delta", data: delta });
        },
      });

      this.messages.push({ role: "assistant", content: fullResponse });
      this.emit({ type: "message_end" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error, sessionId: this.sessionId }, "OpenClaw prompt error");
      this.emit({
        type: "error",
        data: message,
        isError: true,
      });
    }
  }

  subscribe(listener: (event: AgentSessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private emit(event: AgentSessionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Create an AgentSession backed by OpenClaw Gateway.
 */
export function createOpenClawAgentSession(
  opts: OpenClawSessionOptions,
): AgentSession {
  return new OpenClawAgentSession(opts);
}
