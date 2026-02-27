/**
 * SubmissionProgress component tests.
 *
 * Tests the 4-step progress stepper for the submission pipeline.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionProgress } from "../SubmissionProgress";
import type { SubmissionStep } from "@/types/submission";

describe("SubmissionProgress", () => {
  const allPendingSteps: SubmissionStep[] = [
    { name: "confluence", status: "pending" },
    { name: "jira", status: "pending" },
    { name: "git", status: "pending" },
    { name: "beads", status: "pending" },
  ];

  const mixedSteps: SubmissionStep[] = [
    {
      name: "confluence",
      status: "success",
      artifactLink: "https://confluence.example.com/page/123",
    },
    { name: "jira", status: "in_progress" },
    { name: "git", status: "pending" },
    { name: "beads", status: "failed", error: "Beads upload timed out" },
  ];

  const defaultOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all 4 steps", () => {
    render(
      <SubmissionProgress steps={allPendingSteps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByText("Confluence")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
    expect(screen.getByText("Git")).toBeInTheDocument();
    expect(screen.getByText("Beads")).toBeInTheDocument();
  });

  it("shows pending icon for pending steps", () => {
    render(
      <SubmissionProgress steps={allPendingSteps} onRetry={defaultOnRetry} />,
    );

    const pendingIcons = screen.getAllByTestId("status-pending");
    expect(pendingIcons).toHaveLength(4);
  });

  it("shows correct status icons for each step status", () => {
    render(
      <SubmissionProgress steps={mixedSteps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByTestId("status-success")).toBeInTheDocument();
    expect(screen.getByTestId("status-in_progress")).toBeInTheDocument();
    expect(screen.getByTestId("status-pending")).toBeInTheDocument();
    expect(screen.getByTestId("status-failed")).toBeInTheDocument();
  });

  it("shows retry button only for failed steps", () => {
    render(
      <SubmissionProgress steps={mixedSteps} onRetry={defaultOnRetry} />,
    );

    const retryButtons = screen.getAllByRole("button", { name: /retry/i });
    expect(retryButtons).toHaveLength(1);
  });

  it("calls onRetry with the step name when retry is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SubmissionProgress steps={mixedSteps} onRetry={defaultOnRetry} />,
    );

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    expect(defaultOnRetry).toHaveBeenCalledTimes(1);
    expect(defaultOnRetry).toHaveBeenCalledWith("beads");
  });

  it("shows artifact links for successful steps", () => {
    render(
      <SubmissionProgress steps={mixedSteps} onRetry={defaultOnRetry} />,
    );

    const link = screen.getByRole("link", { name: /view artifact/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "https://confluence.example.com/page/123",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not show artifact links for non-successful steps", () => {
    render(
      <SubmissionProgress steps={allPendingSteps} onRetry={defaultOnRetry} />,
    );

    const links = screen.queryAllByRole("link", { name: /view artifact/i });
    expect(links).toHaveLength(0);
  });

  it("shows error message for failed steps", () => {
    render(
      <SubmissionProgress steps={mixedSteps} onRetry={defaultOnRetry} />,
    );

    expect(screen.getByText("Beads upload timed out")).toBeInTheDocument();
  });

  it("renders connecting lines between steps", () => {
    render(
      <SubmissionProgress steps={allPendingSteps} onRetry={defaultOnRetry} />,
    );

    // 3 connectors between 4 steps
    const connectors = screen.getAllByTestId("step-connector");
    expect(connectors).toHaveLength(3);
  });
});
