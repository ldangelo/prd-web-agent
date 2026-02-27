/**
 * PRD detail page component tests.
 *
 * Tests for /prd/[id] - the page with tab navigation (Document, Chat, Comments, History).
 */

// Mock ESM-only react-markdown and remark-gfm before imports
jest.mock("react-markdown", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children }: { children: string }) =>
      React.createElement("div", null, children),
  };
});
jest.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => {},
}));

import { render, screen } from "@testing-library/react";
import PrdDetailPage from "../[id]/page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useParams: () => ({ id: "prd_001" }),
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? null : null),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe("PRD detail page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "prd_001",
          title: "User Auth Flow",
          status: "DRAFT",
          projectId: "proj_001",
        },
      }),
    });
  });

  it("should render tab navigation with expected tabs", () => {
    render(<PrdDetailPage />);

    expect(screen.getByRole("tab", { name: /document/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /comments/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
  });

  it("should render the PRD title heading", () => {
    render(<PrdDetailPage />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it("should render a refine button", () => {
    render(<PrdDetailPage />);

    const button = screen.getByRole("button", { name: /refine/i });
    expect(button).toBeInTheDocument();
  });
});
