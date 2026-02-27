import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBanner } from "../ErrorBanner";

describe("ErrorBanner", () => {
  it("shows error message", () => {
    render(
      <ErrorBanner error="Something went wrong" retryable={false} onRetry={jest.fn()} />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows retry button when retryable", () => {
    render(
      <ErrorBanner error="Network error" retryable={true} onRetry={jest.fn()} />,
    );

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("does not show retry button when not retryable", () => {
    render(
      <ErrorBanner error="Fatal error" retryable={false} onRetry={jest.fn()} />,
    );

    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("hides when no error", () => {
    const { container } = render(
      <ErrorBanner error={null} retryable={false} onRetry={jest.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("calls onRetry when button clicked", async () => {
    const onRetry = jest.fn();
    render(
      <ErrorBanner error="Retryable error" retryable={true} onRetry={onRetry} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
