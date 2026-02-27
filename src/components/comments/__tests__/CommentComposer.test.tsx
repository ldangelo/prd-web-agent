import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentComposer } from "../CommentComposer";

describe("CommentComposer", () => {
  it("renders textarea and submit button", () => {
    render(<CommentComposer onSubmit={jest.fn()} />);

    expect(
      screen.getByRole("textbox", { name: /comment/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit/i })
    ).toBeInTheDocument();
  });

  it("uses custom placeholder when provided", () => {
    render(
      <CommentComposer onSubmit={jest.fn()} placeholder="Write a reply..." />
    );

    expect(screen.getByPlaceholderText("Write a reply...")).toBeInTheDocument();
  });

  it("calls onSubmit with body text when submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(<CommentComposer onSubmit={onSubmit} />);

    await user.type(
      screen.getByRole("textbox", { name: /comment/i }),
      "Great work!"
    );
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith("Great work!");
  });

  it("clears textarea after submit", async () => {
    const user = userEvent.setup();

    render(<CommentComposer onSubmit={jest.fn()} />);

    const textarea = screen.getByRole("textbox", { name: /comment/i });
    await user.type(textarea, "Some text");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(textarea).toHaveValue("");
  });

  it("disables submit button when textarea is empty", () => {
    render(<CommentComposer onSubmit={jest.fn()} />);

    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  it("disables textarea and button when disabled prop is true", () => {
    render(<CommentComposer onSubmit={jest.fn()} disabled />);

    expect(screen.getByRole("textbox", { name: /comment/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });
});
