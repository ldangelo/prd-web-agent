import React from "react";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepoPicker } from "../RepoPicker";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockReposResponse = {
  repos: [
    {
      fullName: "octocat/hello-world",
      name: "hello-world",
      owner: "octocat",
      ownerType: "User",
      description: "My first repository",
      private: false,
      defaultBranch: "main",
    },
    {
      fullName: "octocat/spoon-knife",
      name: "spoon-knife",
      owner: "octocat",
      ownerType: "User",
      description: "A fork of the classic",
      private: false,
      defaultBranch: "main",
    },
    {
      fullName: "acme-org/web-app",
      name: "web-app",
      owner: "acme-org",
      ownerType: "Organization",
      description: "Main web application",
      private: true,
      defaultBranch: "main",
    },
    {
      fullName: "acme-org/api-server",
      name: "api-server",
      owner: "acme-org",
      ownerType: "Organization",
      description: "Backend API server",
      private: true,
      defaultBranch: "main",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(data = mockReposResponse) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

function mockFetchError(status = 500) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: "Internal Server Error" }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RepoPicker", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (global as Record<string, unknown>).fetch;
  });

  it("should render loading state while fetching repos", async () => {
    // Never resolves to keep loading state visible
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

    render(<RepoPicker onChange={mockOnChange} />);

    expect(screen.getByText(/loading repositories/i)).toBeInTheDocument();
  });

  it("should fetch repos from /api/github/repos on mount", async () => {
    mockFetchSuccess();

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/github/repos");
  });

  it("should render repos grouped by owner", async () => {
    mockFetchSuccess();

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    // Should display owner group headings
    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(screen.getByText("acme-org")).toBeInTheDocument();

    // Should display repo names
    expect(screen.getByText("hello-world")).toBeInTheDocument();
    expect(screen.getByText("spoon-knife")).toBeInTheDocument();
    expect(screen.getByText("web-app")).toBeInTheDocument();
    expect(screen.getByText("api-server")).toBeInTheDocument();
  });

  it("should render search input", async () => {
    mockFetchSuccess();

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByPlaceholderText(/search repositories/i),
    ).toBeInTheDocument();
  });

  it("should filter repos with debounced search (300ms)", async () => {
    mockFetchSuccess();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = screen.getByPlaceholderText(/search repositories/i);
    await user.type(searchInput, "web");

    // Before debounce fires, all repos should still be visible
    expect(screen.getByText("hello-world")).toBeInTheDocument();

    // Advance past 300ms debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // After debounce, only matching repos should be visible
    expect(screen.getByText("web-app")).toBeInTheDocument();
    expect(screen.queryByText("hello-world")).not.toBeInTheDocument();
    expect(screen.queryByText("spoon-knife")).not.toBeInTheDocument();
    expect(screen.queryByText("api-server")).not.toBeInTheDocument();
  });

  it("should filter repos by owner name as well", async () => {
    mockFetchSuccess();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = screen.getByPlaceholderText(/search repositories/i);
    await user.type(searchInput, "acme");

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should show acme-org repos
    expect(screen.getByText("web-app")).toBeInTheDocument();
    expect(screen.getByText("api-server")).toBeInTheDocument();

    // Should not show octocat repos
    expect(screen.queryByText("hello-world")).not.toBeInTheDocument();
    expect(screen.queryByText("spoon-knife")).not.toBeInTheDocument();
  });

  it("should call onChange with repo object when a repo is selected", async () => {
    mockFetchSuccess();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    const repoOption = screen.getByText("web-app");
    await user.click(repoOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      name: "web-app",
      fullName: "acme-org/web-app",
      description: "Main web application",
      private: true,
    });
  });

  it("should show the selected repo value", async () => {
    mockFetchSuccess();

    render(
      <RepoPicker value="acme-org/web-app" onChange={mockOnChange} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("acme-org/web-app")).toBeInTheDocument();
  });

  it("should allow deselecting the current repo", async () => {
    mockFetchSuccess();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <RepoPicker value="acme-org/web-app" onChange={mockOnChange} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const clearButton = screen.getByRole("button", { name: /clear selection/i });
    await user.click(clearButton);

    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it("should show empty state when no repos match search", async () => {
    mockFetchSuccess();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = screen.getByPlaceholderText(/search repositories/i);
    await user.type(searchInput, "zzz-nonexistent");

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText(/no repositories found/i)).toBeInTheDocument();
  });

  it("should show error state when fetch fails", async () => {
    mockFetchError(500);

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/failed to load repositories/i)).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", async () => {
    mockFetchSuccess();

    render(<RepoPicker onChange={mockOnChange} disabled />);

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = screen.getByPlaceholderText(/search repositories/i);
    expect(searchInput).toBeDisabled();
  });

  it("should show private badge for private repos", async () => {
    mockFetchSuccess();

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    // acme-org repos are private
    const privateIndicators = screen.getAllByText(/private/i);
    expect(privateIndicators.length).toBe(2);
  });

  it("should show repo description when available", async () => {
    mockFetchSuccess();

    render(<RepoPicker onChange={mockOnChange} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("My first repository")).toBeInTheDocument();
    expect(screen.getByText("Main web application")).toBeInTheDocument();
  });
});
