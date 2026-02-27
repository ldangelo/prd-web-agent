import React from "react";
import { render, screen } from "@testing-library/react";
import { ToolCallIndicator } from "../ToolCallIndicator";

describe("ToolCallIndicator", () => {
  it("shows tool name when active", () => {
    render(<ToolCallIndicator toolName="save_prd" isActive={true} />);

    expect(screen.getByText(/save_prd/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("hides when not active", () => {
    const { container } = render(
      <ToolCallIndicator toolName="save_prd" isActive={false} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("hides when toolName is null", () => {
    const { container } = render(
      <ToolCallIndicator toolName={null} isActive={true} />,
    );

    expect(container.innerHTML).toBe("");
  });
});
