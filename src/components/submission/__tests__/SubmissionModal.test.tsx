/**
 * SubmissionModal component tests.
 *
 * Tests the modal overlay for the submission pipeline.
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionModal } from "../SubmissionModal";
import type { SubmissionStep } from "@/types/submission";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const allPendingSteps: SubmissionStep[] = [
  { name: "confluence", status: "pending" },
  { name: "jira", status: "pending" },
  { name: "git", status: "pending" },
  { name: "beads", status: "pending" },
];

const allSuccessSteps: SubmissionStep[] = [
  { name: "confluence", status: "success", artifactLink: "https://example.com/c" },
  { name: "jira", status: "success", artifactLink: "https://example.com/j" },
  { name: "git", status: "success", artifactLink: "https://example.com/g" },
  { name: "beads", status: "success", artifactLink: "https://example.com/b" },
];

const allTerminalWithFailure: SubmissionStep[] = [
  { name: "confluence", status: "success", artifactLink: "https://example.com/c" },
  { name: "jira", status: "failed", error: "Jira error" },
  { name: "git", status: "failed", error: "Git error" },
  { name: "beads", status: "failed", error: "Beads error" },
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

    // Default: POST succeeds, poll returns all pending
    setupFetchMock(allPendingSteps);
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

  it("close button is disabled while steps are in progress", () => {
    render(<SubmissionModal {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).toBeDisabled();
  });

  it("close button is enabled when all steps are complete", async () => {
    setupFetchMock(allSuccessSteps);

    render(<SubmissionModal {...defaultProps} />);

    // Flush the POST promise chain and the subsequent poll
    await act(async () => {
      await Promise.resolve(); // POST .then
      await Promise.resolve(); // pollStatus fetch
      await Promise.resolve(); // pollStatus .json
      await Promise.resolve(); // setSteps
    });

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).not.toBeDisabled();
  });

  it("close button is enabled when all steps are terminal (including failed)", async () => {
    setupFetchMock(allTerminalWithFailure);

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

    setupFetchMock(allSuccessSteps);

    render(<SubmissionModal {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /close/i }),
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders all 4 submission steps", () => {
    render(<SubmissionModal {...defaultProps} />);

    expect(screen.getByText("Confluence")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
    expect(screen.getByText("Git")).toBeInTheDocument();
    expect(screen.getByText("Beads")).toBeInTheDocument();
  });
});
