/**
 * OpenClaw Gateway HTTP client.
 *
 * Wraps the OpenAI-compatible /v1/chat/completions endpoint exposed by
 * OpenClaw Gateway, with SSE streaming support.
 */
import logger from "@/lib/logger";

export interface OpenClawClientConfig {
  gatewayUrl: string;
  gatewayToken: string;
}

export interface ChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  sessionKey?: string;
  onDelta: (text: string) => void;
}

export class OpenClawClient {
  private gatewayUrl: string;
  private gatewayToken: string;

  constructor(config: OpenClawClientConfig) {
    this.gatewayUrl = config.gatewayUrl.replace(/\/$/, "");
    this.gatewayToken = config.gatewayToken;
  }

  async chat(opts: ChatOptions): Promise<string> {
    const { messages, model, sessionKey, onDelta } = opts;

    const response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.gatewayToken}`,
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        messages,
        stream: true,
        ...(sessionKey ? { user: sessionKey } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenClaw API error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body from OpenClaw API");
    }

    // Parse SSE stream
    let fullText = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onDelta(delta);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  /**
   * Create an OpenClawClient from environment variables.
   */
  static fromEnv(): OpenClawClient {
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

    if (!gatewayUrl || !gatewayToken) {
      throw new Error(
        "OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN must be set",
      );
    }

    logger.info({ gatewayUrl, tokenPrefix: gatewayToken.slice(0, 8) }, "Creating OpenClaw client");
    return new OpenClawClient({ gatewayUrl, gatewayToken });
  }
}
