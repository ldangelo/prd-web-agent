/**
 * SubmissionModal component tests.
 *
 * Tests the single-step modal overlay for GitHub PR submission
 * using shadcn Dialog (Radix UI).
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionModal } from "../SubmissionModal";
import type { SubmissionStep } from "@/types/submission";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const pendingStep: SubmissionStep[] = [
  { name: "github", status: "pending" },
];

const successStep: SubmissionStep[] = [
  {
    name: "github",
    status: "success",
    artifactLink: "https://github.com/org/repo/pull/42",
  },
];

const failedStep: SubmissionStep[] = [
  { name: "github", status: "failed", error: "GitHub API timeout" },
];

function setupFetchMock(statusSteps: SubmissionStep[]) {
  mockFetch.mockImplementation((url: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: "started" }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ steps: statusSteps }),
    });
  });
}

/**
 * Helper to find the explicit Close button (not the Radix DialogClose X icon).
 * The explicit Close button has aria-label="Close" and visible "Close" text.
 */
function getExplicitCloseButton(): HTMLElement {
  const buttons = screen.getAllByRole("button", { name: /close/i });
  // The explicit close button has visible "Close" text content (not sr-only)
  const explicitClose = buttons.find(
    (btn) => btn.textContent?.trim() === "Close" && btn.getAttribute("aria-label") === "Close"
  );
  if (!explicitClose) {
    throw new Error("Could not find explicit Close button");
  }
  return explicitClose;
}

describe("SubmissionModal", () => {
  const defaultProps = {
    prdId: "prd_001",
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    setupFetchMock(pendingStep);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders modal when isOpen is true", () => {
    render(<SubmissionModal {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/submitting prd/i)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<SubmissionModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows close button", () => {
    render(<SubmissionModal {...defaultProps} />);

    expect(getExplicitCloseButton()).toBeInTheDocument();
  });

  it("close button is disabled while step is pending", () => {
    render(<SubmissionModal {...defaultProps} />);

    expect(getExplicitCloseButton()).toBeDisabled();
  });

  it("close button is enabled when step is success", async () => {
    setupFetchMock(successStep);

    render(<SubmissionModal {...defaultProps} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getExplicitCloseButton()).not.toBeDisabled();
  });

  it("close button is enabled when step is failed", async () => {
    setupFetchMock(failedStep);

    render(<SubmissionModal {...defaultProps} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getExplicitCloseButton()).not.toBeDisabled();
  });

  it("POSTs to submit endpoint when opened", async () => {
    render(<SubmissionModal {...defaultProps} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/prds/prd_001/submit",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls onClose when close button is clicked and enabled", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();

    setupFetchMock(successStep);

    render(<SubmissionModal {...defaultProps} />);

    await waitFor(() => {
      expect(getExplicitCloseButton()).not.toBeDisabled();
    });

    await user.click(getExplicitCloseButton());
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the single GitHub PR step", () => {
    render(<SubmissionModal {...defaultProps} />);

    expect(screen.getByText("Creating GitHub PR")).toBeInTheDocument();
  });

  it("does not render old 4-step labels", () => {
    render(<SubmissionModal {...defaultProps} />);

    expect(screen.queryByText("Confluence")).not.toBeInTheDocument();
    expect(screen.queryByText("Jira")).not.toBeInTheDocument();
    expect(screen.queryByText("Beads")).not.toBeInTheDocument();
  });

  it("has a dialog description for screen readers", () => {
    render(<SubmissionModal {...defaultProps} />);

    expect(
      screen.getByText(/creating a github pull request/i),
    ).toBeInTheDocument();
  });
});
