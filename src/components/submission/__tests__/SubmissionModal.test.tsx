/**
 * SubmissionModal component tests.
 *
 * Tests the single-step modal overlay for GitHub PR submission.
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

    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("close button is disabled while step is pending", () => {
    render(<SubmissionModal {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).toBeDisabled();
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

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).not.toBeDisabled();
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

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).not.toBeDisabled();
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
      expect(
        screen.getByRole("button", { name: /close/i }),
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /close/i }));
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
});
