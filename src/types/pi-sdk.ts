/**
 * Pi SDK type stubs.
 *
 * The actual pi SDK is not published on npm, so we define the interfaces
 * locally for compile-time safety and documentation.
 */

// ---------------------------------------------------------------------------
// Tool types (existing)
// ---------------------------------------------------------------------------

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  details?: Record<string, any>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  /** TypeBox schema describing the tool parameters */
  parameters: any;
  execute(
    toolCallId: string,
    params: any,
    signal?: AbortSignal,
    onUpdate?: any,
    ctx?: any,
  ): Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Agent Session
// ---------------------------------------------------------------------------

export interface AgentSessionEvent {
  type:
    | "text_delta"
    | "message_start"
    | "message_end"
    | "tool_start"
    | "tool_end"
    | "error"
    // Real SDK event types (mapped internally)
    | "message_update"
    | "tool_execution_start"
    | "tool_execution_end"
    | "agent_end"
    | "turn_end";
  data?: unknown;
  /** Present on message_update events from the real SDK */
  assistantMessageEvent?: { type: string; delta?: string };
  /** Tool name for tool_execution_start/end events */
  toolName?: string;
  /** Whether the tool execution resulted in an error */
  isError?: boolean;
}

export interface AgentSession {
  sessionId: string;
  prompt(text: string, options?: { images?: unknown[] }): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Resource Loader types
// ---------------------------------------------------------------------------

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  source: string;
}

export interface ResourceLoaderInterface {
  getSkills(): { skills: Skill[]; diagnostics: unknown[] };
  getSystemPrompt(): string;
  getExtensions(): { extensions: unknown[]; errors: unknown[]; runtime: unknown };
  getPrompts(): { prompts: unknown[]; diagnostics: unknown[] };
  getThemes(): { themes: unknown[]; diagnostics: unknown[] };
  getAgentsFiles(): { agentsFiles: unknown[] };
  getAppendSystemPrompt(): unknown[];
  getPathMetadata(): Map<unknown, unknown>;
  extendResources(): void;
  reload(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Session creation options used by the SDK factory
// ---------------------------------------------------------------------------

export interface CreateAgentSessionOptions {
  resourceLoader: ResourceLoaderInterface;
  sessionFilePath?: string;
}

// ---------------------------------------------------------------------------
// Stub factory -- replace with real SDK import later
// ---------------------------------------------------------------------------

let _factory: (opts: CreateAgentSessionOptions) => Promise<AgentSession> =
  async (opts) => {
    const id =
      opts.sessionFilePath ??
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const listeners = new Set<(event: AgentSessionEvent) => void>();
    return {
      sessionId: id,
      async prompt(text: string, _options?: { images?: unknown[] }) {
        for (const l of listeners) {
          l({ type: "message_start" });
          l({ type: "text_delta", data: `[stub] echo: ${text}` });
          l({ type: "message_end" });
        }
      },
      subscribe(listener: (event: AgentSessionEvent) => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      dispose() {
        listeners.clear();
      },
    };
  };

/**
 * Override the default stub factory. Used in tests or when wiring the real SDK.
 */
export function setAgentSessionFactory(
  factory: (opts: CreateAgentSessionOptions) => Promise<AgentSession>,
): void {
  _factory = factory;
}

/**
 * Create an AgentSession via the currently registered factory.
 */
export function createAgentSession(
  opts: CreateAgentSessionOptions,
): Promise<AgentSession> {
  return _factory(opts);
}
