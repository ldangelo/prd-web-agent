/**
 * Admin Settings page tests.
 *
 * Tests the LLM configuration and workflow settings form.
 * Integration credential sections (Confluence, Jira, Git, Beads) have been
 * removed as part of TASK-072 / TASK-065 simplification.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSettingsPage from "../settings/page";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockApiSettings = {
  id: "global",
  llmProvider: "anthropic",
  llmModel: "claude-sonnet-4-20250514",
  llmThinkingLevel: "medium",
  blockApprovalOnUnresolvedComments: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockApiSettings }),
    });
  });

  it("fetches settings from API on mount", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/settings");
    });
  });

  it("shows loading state initially", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // LLM Settings section
  // -----------------------------------------------------------------------

  it("renders LLM Configuration section with provider select", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText(/provider/i);
    expect(providerSelect).toHaveValue("anthropic");

    // Should only have anthropic and openai options
    const options = Array.from(
      providerSelect.querySelectorAll("option"),
    ).map((o) => o.value);
    expect(options).toEqual(["anthropic", "openai"]);
  });

  it("renders LLM model text input", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/model/i)).toHaveValue(
      "claude-sonnet-4-20250514",
    );
  });

  it("renders LLM thinking level select", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/thinking level/i)).toBeInTheDocument();
    });

    const thinkingSelect = screen.getByLabelText(/thinking level/i);
    expect(thinkingSelect).toHaveValue("medium");

    const options = Array.from(
      thinkingSelect.querySelectorAll("option"),
    ).map((o) => o.value);
    expect(options).toEqual(["low", "medium", "high"]);
  });

  // -----------------------------------------------------------------------
  // Workflow Settings section
  // -----------------------------------------------------------------------

  it("renders workflow settings with block approval checkbox", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/block approval on unresolved comments/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText(/block approval on unresolved comments/i),
    ).toBeChecked();
  });

  // -----------------------------------------------------------------------
  // Removed integration sections should NOT appear
  // -----------------------------------------------------------------------

  it("does not render Confluence settings", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/confluence/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confluence url/i)).not.toBeInTheDocument();
  });

  it("does not render Jira settings", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/jira/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/jira url/i)).not.toBeInTheDocument();
  });

  it("does not render Git settings", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/git repository/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/git token/i)).not.toBeInTheDocument();
  });

  it("does not render Beads settings", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/beads project/i)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Save behaviour
  // -----------------------------------------------------------------------

  it("renders save button", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save settings/i }),
      ).toBeInTheDocument();
    });
  });

  it("sends flat fields on save", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockApiSettings }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockApiSettings }),
      });

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save settings/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/settings",
        expect.objectContaining({
          method: "PUT",
          body: expect.any(String),
        }),
      );
    });

    // Verify the body contains flat field names matching the API/model
    const putCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[1] === "object" && (call[1] as Record<string, unknown>).method === "PUT",
    );
    const sentBody = JSON.parse((putCall[1] as Record<string, string>).body);
    expect(sentBody).toEqual(
      expect.objectContaining({
        llmProvider: "anthropic",
        llmModel: "claude-sonnet-4-20250514",
        llmThinkingLevel: "medium",
        blockApprovalOnUnresolvedComments: true,
      }),
    );

    // Should NOT contain integration fields
    expect(sentBody).not.toHaveProperty("confluence");
    expect(sentBody).not.toHaveProperty("jira");
    expect(sentBody).not.toHaveProperty("git");
    expect(sentBody).not.toHaveProperty("beads");
  });

  it("shows success message after successful save", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockApiSettings }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockApiSettings }),
      });

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save settings/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument();
    });
  });

  it("shows error message after failed save", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockApiSettings }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Forbidden" }),
      });

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save settings/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save settings/i)).toBeInTheDocument();
    });
  });
});
