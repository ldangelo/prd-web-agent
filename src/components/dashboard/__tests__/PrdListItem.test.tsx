/**
 * PrdListItem component tests.
 *
 * Verifies rendering of PRD data in a table row with shadcn Badge for status and tags.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrdListItem } from "../PrdListItem";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const basePrd = {
  id: "prd_001",
  title: "User Authentication Flow",
  status: "DRAFT" as const,
  tags: ["auth", "security"],
  currentVersion: 1,
  updatedAt: "2026-02-24T16:00:00.000Z",
  project: { id: "proj_001", name: "Project Alpha" },
  author: { id: "user_1", name: "Alice" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PrdListItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render all PRD fields", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={basePrd} />
        </tbody>
      </table>,
    );

    expect(screen.getByText("User Authentication Flow")).toBeInTheDocument();
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("auth")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });

  it("should render Draft status badge with outline variant", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={{ ...basePrd, status: "DRAFT" }} />
        </tbody>
      </table>,
    );

    const badge = screen.getByText("Draft");
    expect(badge.className).toContain("border");
  });

  it("should render In Review status badge with secondary variant", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={{ ...basePrd, status: "IN_REVIEW" }} />
        </tbody>
      </table>,
    );

    const badge = screen.getByText("In Review");
    expect(badge.className).toContain("bg-secondary");
  });

  it("should render Approved status badge with green styling", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={{ ...basePrd, status: "APPROVED" }} />
        </tbody>
      </table>,
    );

    const badge = screen.getByText("Approved");
    expect(badge.className).toContain("bg-green");
  });

  it("should render Submitted status badge with blue styling", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={{ ...basePrd, status: "SUBMITTED" }} />
        </tbody>
      </table>,
    );

    const badge = screen.getByText("Submitted");
    expect(badge.className).toContain("bg-blue");
  });

  it("should navigate to /prd/[id] when row is clicked", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={basePrd} />
        </tbody>
      </table>,
    );

    const row = screen.getByText("User Authentication Flow").closest("tr");
    fireEvent.click(row!);

    expect(mockPush).toHaveBeenCalledWith("/prd/prd_001");
  });

  it("should render tags as shadcn Badge with secondary variant", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={basePrd} />
        </tbody>
      </table>,
    );

    const authTag = screen.getByText("auth");
    const securityTag = screen.getByText("security");
    // shadcn Badge secondary variant
    expect(authTag.className).toContain("bg-secondary");
    expect(securityTag.className).toContain("bg-secondary");
  });

  it("should handle empty tags array", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={{ ...basePrd, tags: [] }} />
        </tbody>
      </table>,
    );

    expect(screen.getByText("User Authentication Flow")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Accessibility tests
  // ---------------------------------------------------------------------------

  it("should be keyboard accessible with tabIndex", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={basePrd} />
        </tbody>
      </table>,
    );

    const row = screen.getByText("User Authentication Flow").closest("tr");
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("should navigate on Enter key press", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={basePrd} />
        </tbody>
      </table>,
    );

    const row = screen.getByText("User Authentication Flow").closest("tr")!;
    fireEvent.keyDown(row, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/prd/prd_001");
  });

  it("should navigate on Space key press", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={basePrd} />
        </tbody>
      </table>,
    );

    const row = screen.getByText("User Authentication Flow").closest("tr")!;
    fireEvent.keyDown(row, { key: " " });

    expect(mockPush).toHaveBeenCalledWith("/prd/prd_001");
  });

  it("should have an aria-label with title and status", () => {
    render(
      <table>
        <tbody>
          <PrdListItem prd={basePrd} />
        </tbody>
      </table>,
    );

    const row = screen.getByText("User Authentication Flow").closest("tr");
    expect(row).toHaveAttribute(
      "aria-label",
      "User Authentication Flow - Draft",
    );
  });
});
