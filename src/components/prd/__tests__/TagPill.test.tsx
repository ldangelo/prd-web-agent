/**
 * TagPill component tests.
 *
 * Tests for the tag display pill component.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPill } from "../TagPill";

describe("TagPill", () => {
  it("renders tag text", () => {
    render(<TagPill tag="authentication" />);
    expect(screen.getByText("authentication")).toBeInTheDocument();
  });

  it("does not show remove button by default", () => {
    render(<TagPill tag="feature" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows remove button when removable is true", () => {
    render(<TagPill tag="feature" removable onRemove={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", async () => {
    const onRemove = jest.fn();
    render(<TagPill tag="feature" removable onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders as a span element", () => {
    render(<TagPill tag="design" />);
    const pill = screen.getByText("design");
    expect(pill.closest("span")).toBeInTheDocument();
  });
});
