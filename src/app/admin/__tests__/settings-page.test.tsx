/**
 * Admin Settings page tests.
 *
 * Tests the integration, LLM, and workflow settings form.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSettingsPage from "../settings/page";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockSettings = {
  confluence: {
    url: "https://confluence.example.com",
    email: "admin@example.com",
    space: "ENG",
    token: "conf-token-123",
  },
  jira: {
    url: "https://jira.example.com",
    email: "admin@example.com",
    project: "PRD",
    token: "jira-token-456",
  },
  git: {
    repo: "https://github.com/org/repo",
    token: "git-token-789",
  },
  beads: {
    project: "my-project",
  },
  llm: {
    provider: "anthropic",
    model: "claude-3-opus",
    thinkingLevel: "medium",
  },
  workflow: {
    blockApprovalOnUnresolved: true,
  },
};

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSettings,
    });
  });

  it("renders integration settings form", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/confluence url/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/jira url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/git repository/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/beads project/i)).toBeInTheDocument();
  });

  it("fetches settings from API on mount", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/settings");
    });
  });

  it("renders LLM settings section", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thinking level/i)).toBeInTheDocument();
  });

  it("renders workflow settings section", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/block approval on unresolved comments/i),
      ).toBeInTheDocument();
    });
  });

  it("renders save button", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save settings/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders token fields as password inputs", async () => {
    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/confluence.*token/i)).toHaveAttribute(
        "type",
        "password",
      );
    });

    expect(screen.getByLabelText(/jira.*token/i)).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(/git.*token/i)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("calls PUT on save", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
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
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });
});
