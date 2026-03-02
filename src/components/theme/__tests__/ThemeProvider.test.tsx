/**
 * Tests for ThemeProvider and useTheme hook.
 */
import React from "react";
import {
  render,
  screen,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme, STORAGE_KEY } from "../ThemeProvider";

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------

let mockDarkOS = false;
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

function setupMatchMedia(dark: boolean) {
  mockDarkOS = dark;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? mockDarkOS : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: jest.fn(),
    })),
  });
}

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Test component
// ---------------------------------------------------------------------------

function ThemeDisplay() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setPreference("DARK")}>Set Dark</button>
      <button onClick={() => setPreference("LIGHT")}>Set Light</button>
      <button onClick={() => setPreference("SYSTEM")}>Set System</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearStorage();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  mockAddEventListener.mockClear();
  mockRemoveEventListener.mockClear();
  document.documentElement.classList.remove("dark");
  setupMatchMedia(false);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThemeProvider", () => {
  it("defaults to SYSTEM preference", () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("preference").textContent).toBe("SYSTEM");
  });

  it("resolves SYSTEM to dark when OS is dark", () => {
    setupMatchMedia(true);
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });

  it("resolves SYSTEM to light when OS is light", () => {
    setupMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("setPreference(DARK) adds .dark to html element", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setPreference(LIGHT) removes .dark from html element", async () => {
    document.documentElement.classList.add("dark");
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setPreference persists to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Dark"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("DARK");
  });

  it("restores preference from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, "DARK");
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("preference").textContent).toBe("DARK");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });

  it("fires PUT /api/user/theme", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Dark"));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/user/theme",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ themePreference: "DARK" }),
        }),
      );
    });
  });

  it("silently ignores API error when unauthenticated", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    // Should not throw
    await expect(
      user.click(screen.getByText("Set Dark")),
    ).resolves.not.toThrow();
  });

  it("OS change updates resolved theme when SYSTEM", async () => {
    setupMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("resolved").textContent).toBe("light");

    // Simulate OS change event
    const changeHandler = mockAddEventListener.mock.calls[0]?.[1];
    if (changeHandler) {
      act(() => {
        changeHandler({ matches: true });
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId("resolved").textContent).toBe("dark");
    });
  });

  it("OS change is ignored when preference is not SYSTEM", async () => {
    localStorage.setItem(STORAGE_KEY, "LIGHT");
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("resolved").textContent).toBe("light");

    const changeHandler = mockAddEventListener.mock.calls[0]?.[1];
    if (changeHandler) {
      act(() => {
        changeHandler({ matches: true });
      });
    }

    // Still light because preference is LIGHT, not SYSTEM
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("removes matchMedia listener on unmount", () => {
    const { unmount } = render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("useTheme throws when used outside ThemeProvider", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    function BadComponent() {
      useTheme();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      "useTheme must be used within ThemeProvider",
    );

    consoleError.mockRestore();
  });

  it("resolved theme reflects actual applied theme for SYSTEM mode", async () => {
    setupMatchMedia(true);
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("preference").textContent).toBe("SYSTEM");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
