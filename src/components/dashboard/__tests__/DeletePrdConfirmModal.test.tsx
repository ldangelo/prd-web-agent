/**
 * DeletePrdConfirmModal component tests.
 *
 * TDD: These tests are written first to drive the implementation.
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DeletePrdConfirmModal } from "../DeletePrdConfirmModal";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DeletePrdConfirmModal", () => {
  const defaultProps = {
    open: true,
    prdTitle: "My Important PRD",
    onConfirm: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
    isDeleting: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with the correct title containing the PRD name", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    expect(
      screen.getByText(/delete 'My Important PRD'/i),
    ).toBeInTheDocument();
  });

  it("shows 'cannot be undone' warning text", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("renders a Cancel button", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders a Delete button", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("Delete button is disabled for first 1000ms", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    const deleteButton = screen.getByRole("button", { name: /^delete$/i });
    expect(deleteButton).toBeDisabled();
  });

  it("Delete button is enabled after 1000ms", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    const deleteButton = screen.getByRole("button", { name: /^delete$/i });
    expect(deleteButton).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(deleteButton).not.toBeDisabled();
  });

  it("Delete button remains disabled at 999ms", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    const deleteButton = screen.getByRole("button", { name: /^delete$/i });

    act(() => {
      jest.advanceTimersByTime(999);
    });

    expect(deleteButton).toBeDisabled();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = jest.fn();
    render(<DeletePrdConfirmModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Delete button is clicked after guard period", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <DeletePrdConfirmModal {...defaultProps} onConfirm={onConfirm} />,
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm when Delete button is clicked before guard period", () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <DeletePrdConfirmModal {...defaultProps} onConfirm={onConfirm} />,
    );

    const deleteButton = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(deleteButton);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <DeletePrdConfirmModal {...defaultProps} open={false} />,
    );

    expect(
      screen.queryByText(/delete 'My Important PRD'/i),
    ).not.toBeInTheDocument();
  });

  it("Delete button is disabled when isDeleting is true (even after guard)", () => {
    render(
      <DeletePrdConfirmModal {...defaultProps} isDeleting={true} />,
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // When isDeleting the button text changes to "Deleting…" and is disabled.
    const deleteButton = screen.getByRole("button", { name: /deleting/i });
    expect(deleteButton).toBeDisabled();
  });

  it("has role=dialog and aria-modal on the dialog element", () => {
    render(<DeletePrdConfirmModal {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
