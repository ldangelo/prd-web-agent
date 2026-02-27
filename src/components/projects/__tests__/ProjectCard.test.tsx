import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectCard } from "../ProjectCard";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("ProjectCard", () => {
  const defaultProps = {
    id: "proj_001",
    name: "E-Commerce Platform",
    description: "An online store for selling widgets",
    memberCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders project name", () => {
    render(<ProjectCard {...defaultProps} />);
    expect(screen.getByText("E-Commerce Platform")).toBeInTheDocument();
  });

  it("renders project description", () => {
    render(<ProjectCard {...defaultProps} />);
    expect(
      screen.getByText("An online store for selling widgets"),
    ).toBeInTheDocument();
  });

  it("renders member count", () => {
    render(<ProjectCard {...defaultProps} />);
    expect(screen.getByText(/5 members/i)).toBeInTheDocument();
  });

  it("renders singular member text for 1 member", () => {
    render(<ProjectCard {...defaultProps} memberCount={1} />);
    expect(screen.getByText(/1 member$/i)).toBeInTheDocument();
  });

  it("navigates to project detail on click", async () => {
    render(<ProjectCard {...defaultProps} />);
    const card = screen.getByRole("article");
    await userEvent.click(card);
    expect(mockPush).toHaveBeenCalledWith("/projects/proj_001");
  });

  it("is keyboard accessible", () => {
    render(<ProjectCard {...defaultProps} />);
    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("tabIndex", "0");
  });
});
