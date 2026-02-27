/**
 * SubmissionProgress component tests.
 *
 * Tests the single-step progress display for GitHub PR creation.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionProgress } from "../SubmissionProgress";
import type { SubmissionStep } from "@/types/submission";

describe("SubmissionProgress", () => {
  const defaultOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the GitHub PR step label", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "pending" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByText("Creating GitHub PR")).toBeInTheDocument();
  });

  it("shows pending icon for pending step", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "pending" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByTestId("status-pending")).toBeInTheDocument();
  });

  it("shows in_progress icon for in_progress step", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "in_progress" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByTestId("status-in_progress")).toBeInTheDocument();
  });

  it("shows success icon for success step", () => {
    const steps: SubmissionStep[] = [
      {
        name: "github",
        status: "success",
        artifactLink: "https://github.com/org/repo/pull/42",
      },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByTestId("status-success")).toBeInTheDocument();
  });

  it("shows failed icon for failed step", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "failed", error: "API error" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByTestId("status-failed")).toBeInTheDocument();
  });

  it("shows clickable PR link on success", () => {
    const steps: SubmissionStep[] = [
      {
        name: "github",
        status: "success",
        artifactLink: "https://github.com/org/repo/pull/42",
      },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    const link = screen.getByRole("link", { name: /view pull request/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://github.com/org/repo/pull/42");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not show PR link when step is not success", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "pending" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows error message for failed step", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "failed", error: "GitHub API timeout" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByText("GitHub API timeout")).toBeInTheDocument();
  });

  it("shows retry button for failed step", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "failed", error: "API error" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onRetry with step name when retry is clicked", async () => {
    const user = userEvent.setup();
    const steps: SubmissionStep[] = [
      { name: "github", status: "failed", error: "API error" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(defaultOnRetry).toHaveBeenCalledTimes(1);
    expect(defaultOnRetry).toHaveBeenCalledWith("github");
  });

  it("does not show retry button when step is not failed", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "in_progress" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("does not render connector lines (single step, no connectors)", () => {
    const steps: SubmissionStep[] = [
      { name: "github", status: "pending" },
    ];

    render(
      <SubmissionProgress steps={steps} onRetry={defaultOnRetry} />,
    );

    expect(screen.queryByTestId("step-connector")).not.toBeInTheDocument();
  });
});
