import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders Draft status with outline variant", () => {
    render(<StatusBadge status="Draft" />);

    const badge = screen.getByText("Draft");
    expect(badge).toBeInTheDocument();
    // outline variant has no bg-* class, just border
    expect(badge.className).toContain("border");
    expect(badge.className).not.toContain("bg-green");
    expect(badge.className).not.toContain("bg-blue");
  });

  it("renders In Review status with secondary variant", () => {
    render(<StatusBadge status="In Review" />);

    const badge = screen.getByText("In Review");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-secondary");
  });

  it("renders Approved status with green styling", () => {
    render(<StatusBadge status="Approved" />);

    const badge = screen.getByText("Approved");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-green");
  });

  it("renders Submitted status with blue styling", () => {
    render(<StatusBadge status="Submitted" />);

    const badge = screen.getByText("Submitted");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-blue");
  });

  it("renders unknown status with outline fallback", () => {
    render(<StatusBadge status="Unknown" />);

    const badge = screen.getByText("Unknown");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("border");
  });
});
