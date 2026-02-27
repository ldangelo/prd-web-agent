/**
 * VersionHistory component tests.
 *
 * Verifies that versions are fetched and rendered, including change summaries.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VersionHistory } from "../VersionHistory";

const MOCK_VERSIONS = [
  {
    id: "v1",
    version: 1,
    authorId: "user_1",
    changeSummary: "Initial draft",
    createdAt: "2026-02-20T10:00:00.000Z",
  },
  {
    id: "v2",
    version: 2,
    authorId: "user_1",
    changeSummary: "Added requirements section",
    createdAt: "2026-02-22T14:00:00.000Z",
  },
  {
    id: "v3",
    version: 3,
    authorId: "user_2",
    changeSummary: "Revised scope and timeline",
    createdAt: "2026-02-24T09:00:00.000Z",
  },
];

const mockFetch = jest.fn();

beforeEach(() => {
  jest.restoreAllMocks();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  // @ts-expect-error - cleaning up global mock
  delete global.fetch;
});

describe("VersionHistory", () => {
  it("renders version list after fetching", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: MOCK_VERSIONS }),
    });

    render(<VersionHistory prdId="prd_001" />);

    await waitFor(() => {
      expect(screen.getByText("Version 1")).toBeInTheDocument();
    });

    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Version 3")).toBeInTheDocument();
  });

  it("shows change summaries", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: MOCK_VERSIONS }),
    });

    render(<VersionHistory prdId="prd_001" />);

    await waitFor(() => {
      expect(screen.getByText("Initial draft")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Added requirements section"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Revised scope and timeline"),
    ).toBeInTheDocument();
  });

  it("calls onVersionSelect when a version is clicked", async () => {
    const onVersionSelect = jest.fn();

    // First call: fetch version list
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: MOCK_VERSIONS }),
    });

    // Second call: fetch specific version content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { content: "# Version 2 Content" } }),
    });

    render(
      <VersionHistory prdId="prd_001" onVersionSelect={onVersionSelect} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Version 2")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("Version 2"));

    await waitFor(() => {
      expect(onVersionSelect).toHaveBeenCalledWith("# Version 2 Content");
    });
  });

  it("shows loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<VersionHistory prdId="prd_001" />);

    expect(screen.getByText("Loading versions...")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<VersionHistory prdId="prd_001" />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load version history"),
      ).toBeInTheDocument();
    });
  });
});
