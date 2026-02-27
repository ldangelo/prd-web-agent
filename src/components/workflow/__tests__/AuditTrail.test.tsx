import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuditTrail } from "../AuditTrail";

const mockAuditEntries = [
  {
    id: "a1",
    timestamp: "2026-01-15T10:00:00Z",
    userId: "u1",
    userName: "Alice",
    fromStatus: "Draft",
    toStatus: "In Review",
    comment: null,
  },
  {
    id: "a2",
    timestamp: "2026-01-16T14:00:00Z",
    userId: "u2",
    userName: "Bob",
    fromStatus: "In Review",
    toStatus: "Draft",
    comment: "Needs more detail in section 3",
  },
];

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AuditTrail", () => {
  it("renders audit entries after fetching", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuditEntries,
    });

    render(<AuditTrail prdId="prd-1" />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows status transitions", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuditEntries,
    });

    render(<AuditTrail prdId="prd-1" />);

    await waitFor(() => {
      expect(screen.getAllByText(/Draft/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/In Review/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows comments when present", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuditEntries,
    });

    render(<AuditTrail prdId="prd-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("Needs more detail in section 3")
      ).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<AuditTrail prdId="prd-1" />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
