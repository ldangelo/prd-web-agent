// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

jest.mock("@/services/llm-config-service", () => ({
  getLlmConfig: jest.fn().mockResolvedValue({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    thinkingLevel: "medium",
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AgentSessionManager } from "../agent-session-manager";
import { setAgentSessionFactory } from "@/types/pi-sdk";
import type { AgentSession, AgentSessionEvent } from "@/types/pi-sdk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeSession(id: string): AgentSession {
  const listeners = new Set<(e: AgentSessionEvent) => void>();
  return {
    sessionId: id,
    async prompt(text: string) {
      for (const l of listeners) {
        l({ type: "text_delta", data: text });
      }
    },
    subscribe(listener: (e: AgentSessionEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: jest.fn(),
  };
}

let sessionCounter = 0;

beforeEach(() => {
  sessionCounter = 0;
  setAgentSessionFactory(async () => {
    sessionCounter++;
    return makeFakeSession(`fake-${sessionCounter}`);
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentSessionManager", () => {
  it("creates a session and returns a sessionId", async () => {
    const mgr = new AgentSessionManager();
    const { sessionId } = await mgr.createSession({
      userId: "user-1",
      mode: "create",
      projectId: "proj-1",
    });

    expect(sessionId).toBe("fake-1");
    await mgr.disposeAll();
  });

  it("tracks active session count", async () => {
    const mgr = new AgentSessionManager();
    expect(mgr.getActiveSessionCount()).toBe(0);

    await mgr.createSession({
      userId: "u1",
      mode: "create",
      projectId: "p1",
    });
    expect(mgr.getActiveSessionCount()).toBe(1);

    await mgr.createSession({
      userId: "u2",
      mode: "refine",
      projectId: "p2",
      prdContent: "# Draft",
    });
    expect(mgr.getActiveSessionCount()).toBe(2);

    await mgr.disposeAll();
    expect(mgr.getActiveSessionCount()).toBe(0);
  });

  it("evicts a session after the idle timeout", async () => {
    jest.useFakeTimers();

    const idleMs = 5000;
    const mgr = new AgentSessionManager(idleMs);

    const { sessionId } = await mgr.createSession({
      userId: "u1",
      mode: "create",
      projectId: "p1",
    });
    expect(mgr.getActiveSessionCount()).toBe(1);

    // Advance past the idle timeout
    jest.advanceTimersByTime(idleMs + 100);

    expect(mgr.getActiveSessionCount()).toBe(0);

    // Prompting the evicted session should throw
    await expect(mgr.prompt(sessionId, "hello")).rejects.toThrow(
      /No active session found/,
    );

    await mgr.disposeAll();
  });

  it("resets the idle timer on prompt activity", async () => {
    jest.useFakeTimers();

    const idleMs = 5000;
    const mgr = new AgentSessionManager(idleMs);

    const { sessionId } = await mgr.createSession({
      userId: "u1",
      mode: "create",
      projectId: "p1",
    });

    // Advance partway
    jest.advanceTimersByTime(3000);
    expect(mgr.getActiveSessionCount()).toBe(1);

    // Activity resets the timer
    await mgr.prompt(sessionId, "still here");

    // Advance another 3s -- would have exceeded original 5s but timer was reset
    jest.advanceTimersByTime(3000);
    expect(mgr.getActiveSessionCount()).toBe(1);

    // Now let the full idle period elapse without activity
    jest.advanceTimersByTime(idleMs + 100);
    expect(mgr.getActiveSessionCount()).toBe(0);

    await mgr.disposeAll();
  });

  it("disposeAll clears all sessions and calls dispose on each", async () => {
    const mgr = new AgentSessionManager();

    await mgr.createSession({
      userId: "u1",
      mode: "create",
      projectId: "p1",
    });
    await mgr.createSession({
      userId: "u2",
      mode: "create",
      projectId: "p2",
    });

    expect(mgr.getActiveSessionCount()).toBe(2);
    await mgr.disposeAll();
    expect(mgr.getActiveSessionCount()).toBe(0);
  });

  it("subscribe forwards events from the underlying session", async () => {
    const mgr = new AgentSessionManager();

    const { sessionId } = await mgr.createSession({
      userId: "u1",
      mode: "create",
      projectId: "p1",
    });

    const events: AgentSessionEvent[] = [];
    const unsub = mgr.subscribe(sessionId, (e) => events.push(e));

    await mgr.prompt(sessionId, "test message");

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("text_delta");

    unsub();
    await mgr.disposeAll();
  });

  it("throws when prompting a non-existent session", async () => {
    const mgr = new AgentSessionManager();
    await expect(mgr.prompt("nonexistent", "hi")).rejects.toThrow(
      /No active session found/,
    );
  });
});
