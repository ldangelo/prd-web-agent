import React from "react";
import { render, screen, act } from "@testing-library/react";
import ProjectsPage from "../page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

const mockProjects = [
  {
    id: "proj_001",
    name: "E-Commerce Platform",
    description: "An online store",
    _count: { members: 5 },
  },
  {
    id: "proj_002",
    name: "Internal Dashboard",
    description: "Company metrics dashboard",
    _count: { members: 3 },
  },
];

describe("Projects page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockProjects }),
    });
  });

  it("renders the projects heading", async () => {
    await act(async () => {
      render(<ProjectsPage />);
    });

    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Projects");
  });

  it("renders create project button", async () => {
    await act(async () => {
      render(<ProjectsPage />);
    });

    expect(
      screen.getByRole("link", { name: /create project/i }),
    ).toBeInTheDocument();
  });

  it("fetches and displays project cards", async () => {
    await act(async () => {
      render(<ProjectsPage />);
    });

    expect(await screen.findByText("E-Commerce Platform")).toBeInTheDocument();
    expect(
      await screen.findByText("Internal Dashboard"),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    // Don't resolve fetch yet
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<ProjectsPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows error message on fetch failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await act(async () => {
      render(<ProjectsPage />);
    });

    expect(
      await screen.findByText(/failed to load projects/i),
    ).toBeInTheDocument();
  });
});
