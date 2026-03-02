/**
 * usePrdGeneration hook tests.
 *
 * Verifies that the hook correctly:
 *  - Fetches initial PRD content on mount
 *  - Connects to Socket.io with the real user ID (not a placeholder)
 *  - Initializes the Socket.io server via /api/socketio before connecting
 *  - Accumulates streaming text from agent:text_delta events
 *  - Re-fetches content when agent:prd_saved is received
 *  - Sets error state on agent:error
 *  - Resets streaming text on agent:message_start
 *  - Disconnects the socket on unmount
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports
// ---------------------------------------------------------------------------

// Mock next-auth/react to provide a controlled session
const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// Mock socket.io-client to capture connection arguments and simulate events
const mockSocketOn = jest.fn();
const mockSocketDisconnect = jest.fn();
const mockSocket = {
  on: mockSocketOn,
  disconnect: mockSocketDisconnect,
};
const mockIo = jest.fn().mockReturnValue(mockSocket);
jest.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => mockIo(...args),
}));

// Mock global fetch
global.fetch = jest.fn();

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { renderHook, act, waitFor } from "@testing-library/react";
import { usePrdGeneration } from "../usePrdGeneration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRD_ID = "prd-test-123";
const USER_ID = "user-real-abc123";

/** Returns a mock fetch response for the /api/prds/{id}/versions/latest endpoint. */
function mockVersionsLatestResponse(overrides?: {
  generationStatus?: string | null;
  version?: { content: string } | null;
}) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      data: {
        prd: {
          id: PRD_ID,
          title: "Test PRD",
          status: "DRAFT",
          generationStatus: overrides?.generationStatus ?? null,
          generationError: null,
          currentVersion: 1,
        },
        version: overrides?.version !== undefined
          ? overrides.version
          : {
              id: "ver-1",
              version: 1,
              content: "# My PRD\n\nContent here.",
              changeSummary: "Initial",
              createdAt: "2026-01-01T00:00:00Z",
            },
      },
    }),
  };
}

/** Simulate a Socket.io event by invoking the registered listener. */
function emitSocketEvent(eventName: string, data: unknown) {
  const call = mockSocketOn.mock.calls.find((c: any[]) => c[0] === eventName);
  if (!call) {
    throw new Error(`No listener registered for event: ${eventName}`);
  }
  call[1](data);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default: authenticated session with a real user ID
  mockUseSession.mockReturnValue({
    data: { user: { id: USER_ID, email: "test@example.com", role: "AUTHOR" } },
    status: "authenticated",
  });

  // Default: /api/socketio init endpoint returns 200
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url === "/api/socketio") {
      return Promise.resolve({ ok: true, end: jest.fn() });
    }
    // Default: latest version response (no active generation)
    return Promise.resolve(mockVersionsLatestResponse());
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePrdGeneration", () => {
  describe("initial content fetch", () => {
    it("fetches the latest version on mount", async () => {
      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(result.current.title).toBe("Test PRD");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/prds/${PRD_ID}/versions/latest`,
      );
    });

    it("sets content from the latest version", async () => {
      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(result.current.content).toBe("# My PRD\n\nContent here.");
      });
    });

    it("sets isGenerating true when generationStatus is pending", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === "/api/socketio") return Promise.resolve({ ok: true });
        return Promise.resolve(
          mockVersionsLatestResponse({ generationStatus: "pending", version: null }),
        );
      });

      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
      });
    });

    it("sets isGenerating true when generationStatus is generating", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === "/api/socketio") return Promise.resolve({ ok: true });
        return Promise.resolve(
          mockVersionsLatestResponse({ generationStatus: "generating", version: null }),
        );
      });

      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
      });
    });

    it("sets error when generationStatus is failed", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === "/api/socketio") return Promise.resolve({ ok: true });
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({
            data: {
              prd: {
                id: PRD_ID,
                title: "Test PRD",
                status: "DRAFT",
                generationStatus: "failed",
                generationError: "Out of tokens",
                currentVersion: 0,
              },
              version: null,
            },
          }),
        });
      });

      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(result.current.error).toBe("Out of tokens");
        expect(result.current.isGenerating).toBe(false);
      });
    });
  });

  describe("Socket.io connection", () => {
    it("calls /api/socketio to initialize the server before connecting", async () => {
      renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/socketio");
      });
    });

    it("connects with the real user ID from the session — not 'current'", async () => {
      renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(mockIo).toHaveBeenCalledWith(
          "/agent",
          expect.objectContaining({
            auth: { userId: USER_ID },
          }),
        );
      });

      // Explicitly verify it does NOT use the placeholder "current"
      const [, opts] = mockIo.mock.calls[0];
      expect(opts.auth.userId).not.toBe("current");
      expect(opts.auth.userId).toBe(USER_ID);
    });

    it("does not connect when session is loading", async () => {
      mockUseSession.mockReturnValue({ data: null, status: "loading" });

      renderHook(() => usePrdGeneration(PRD_ID));

      // Give async effects time to flush
      await new Promise((r) => setTimeout(r, 50));

      expect(mockIo).not.toHaveBeenCalled();
    });

    it("does not connect when unauthenticated", async () => {
      mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

      renderHook(() => usePrdGeneration(PRD_ID));

      await new Promise((r) => setTimeout(r, 50));

      expect(mockIo).not.toHaveBeenCalled();
    });

    it("disconnects the socket on unmount", async () => {
      const { unmount } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(mockIo).toHaveBeenCalled();
      });

      unmount();

      expect(mockSocketDisconnect).toHaveBeenCalled();
    });
  });

  describe("streaming text", () => {
    it("accumulates text from agent:text_delta events", async () => {
      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(mockSocketOn).toHaveBeenCalledWith(
          "agent:text_delta",
          expect.any(Function),
        );
      });

      act(() => {
        emitSocketEvent("agent:text_delta", { delta: "Hello " });
        emitSocketEvent("agent:text_delta", { delta: "world" });
      });

      expect(result.current.streamingText).toBe("Hello world");
    });

    it("resets streaming text on agent:message_start", async () => {
      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(mockSocketOn).toHaveBeenCalledWith(
          "agent:message_start",
          expect.any(Function),
        );
      });

      act(() => {
        emitSocketEvent("agent:text_delta", { delta: "Old text" });
      });

      expect(result.current.streamingText).toBe("Old text");

      act(() => {
        emitSocketEvent("agent:message_start", {});
      });

      expect(result.current.streamingText).toBe("");
    });
  });

  describe("agent:prd_saved event", () => {
    it("re-fetches content and clears streaming text when PRD is saved", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === "/api/socketio") return Promise.resolve({ ok: true });
        return Promise.resolve(
          mockVersionsLatestResponse({ generationStatus: "generating", version: null }),
        );
      });

      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(mockSocketOn).toHaveBeenCalledWith(
          "agent:prd_saved",
          expect.any(Function),
        );
      });

      // Simulate streaming text accumulating
      act(() => {
        emitSocketEvent("agent:text_delta", { delta: "Streaming..." });
      });
      expect(result.current.streamingText).toBe("Streaming...");

      // Now mock a completed version for the re-fetch
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === "/api/socketio") return Promise.resolve({ ok: true });
        return Promise.resolve(
          mockVersionsLatestResponse({
            generationStatus: "completed",
            version: {
              id: "ver-1",
              version: 1,
              content: "# Final PRD",
              changeSummary: "Generated",
              createdAt: "2026-01-01T00:00:00Z",
            } as any,
          }),
        );
      });

      act(() => {
        emitSocketEvent("agent:prd_saved", { prdId: PRD_ID, version: 1 });
      });

      await waitFor(() => {
        expect(result.current.streamingText).toBe("");
        expect(result.current.isGenerating).toBe(false);
      });
    });
  });

  describe("agent:error event", () => {
    it("sets error state and stops generating on agent:error", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === "/api/socketio") return Promise.resolve({ ok: true });
        return Promise.resolve(
          mockVersionsLatestResponse({ generationStatus: "generating", version: null }),
        );
      });

      const { result } = renderHook(() => usePrdGeneration(PRD_ID));

      await waitFor(() => {
        expect(mockSocketOn).toHaveBeenCalledWith(
          "agent:error",
          expect.any(Function),
        );
      });

      act(() => {
        emitSocketEvent("agent:error", { error: "Agent timed out" });
      });

      expect(result.current.error).toBe("Agent timed out");
      expect(result.current.isGenerating).toBe(false);
    });
  });
});
