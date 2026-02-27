import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentItem } from "../CommentItem";
import type { CommentData } from "@/types/comments";

const baseComment: CommentData = {
  id: "c1",
  authorId: "u1",
  authorName: "Alice Smith",
  body: "This section needs more detail.",
  resolved: false,
  createdAt: "2026-01-15T10:30:00Z",
  replies: [],
};

describe("CommentItem", () => {
  it("renders author name, body, and timestamp", () => {
    render(
      <CommentItem comment={baseComment} onResolve={jest.fn()} showResolve />
    );

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(
      screen.getByText("This section needs more detail.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Jan/)).toBeInTheDocument();
  });

  it("renders author initials avatar", () => {
    render(
      <CommentItem comment={baseComment} onResolve={jest.fn()} showResolve />
    );

    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("shows resolve button when showResolve is true", () => {
    render(
      <CommentItem comment={baseComment} onResolve={jest.fn()} showResolve />
    );

    expect(
      screen.getByRole("button", { name: /resolve/i })
    ).toBeInTheDocument();
  });

  it("does not show resolve button when showResolve is false", () => {
    render(
      <CommentItem
        comment={baseComment}
        onResolve={jest.fn()}
        showResolve={false}
      />
    );

    expect(
      screen.queryByRole("button", { name: /resolve/i })
    ).not.toBeInTheDocument();
  });

  it("calls onResolve with comment id when resolve button is clicked", async () => {
    const user = userEvent.setup();
    const onResolve = jest.fn();

    render(
      <CommentItem comment={baseComment} onResolve={onResolve} showResolve />
    );

    await user.click(screen.getByRole("button", { name: /resolve/i }));
    expect(onResolve).toHaveBeenCalledWith("c1");
  });

  it("shows unresolve button when comment is resolved", () => {
    const resolved = { ...baseComment, resolved: true };
    render(
      <CommentItem comment={resolved} onResolve={jest.fn()} showResolve />
    );

    expect(
      screen.getByRole("button", { name: /unresolve/i })
    ).toBeInTheDocument();
  });
});
