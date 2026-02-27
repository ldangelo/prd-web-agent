/**
 * New PRD page component tests.
 *
 * Tests for /prd/new - the page that creates a new PRD via agent.
 */
import { render, screen, act } from "@testing-library/react";
import NewPrdPage from "../new/page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock fetch for project loading
global.fetch = jest.fn();

describe("New PRD page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "proj_001", name: "E-Commerce Platform" },
          { id: "proj_002", name: "Internal Dashboard" },
        ],
      }),
    });
  });

  it("should render the page heading", async () => {
    await act(async () => {
      render(<NewPrdPage />);
    });

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("New PRD");
  });

  it("should render a project selector", async () => {
    await act(async () => {
      render(<NewPrdPage />);
    });

    const select = screen.getByLabelText(/project/i);
    expect(select).toBeInTheDocument();
  });

  it("should render a description textarea", async () => {
    await act(async () => {
      render(<NewPrdPage />);
    });

    const textarea = screen.getByLabelText(/description/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName.toLowerCase()).toBe("textarea");
  });

  it("should render a start button", async () => {
    await act(async () => {
      render(<NewPrdPage />);
    });

    const button = screen.getByRole("button", { name: /start/i });
    expect(button).toBeInTheDocument();
  });
});
