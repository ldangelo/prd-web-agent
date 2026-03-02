/**
 * DeletePrdButton component tests.
 *
 * TDD: These tests are written first to drive the implementation.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeletePrdButton } from "../DeletePrdButton";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const draftOwnerPrd = {
  id: "prd_001",
  title: "My Draft PRD",
  status: "DRAFT",
  author: { id: "user_1" },
};

const currentUserId = "user_1";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DeletePrdButton", () => {
  it("renders null when status is not DRAFT", () => {
    const { container } = render(
      <DeletePrdButton
        prd={{ ...draftOwnerPrd, status: "IN_REVIEW" }}
        currentUserId={currentUserId}
        onDeleted={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when status is APPROVED", () => {
    const { container } = render(
      <DeletePrdButton
        prd={{ ...draftOwnerPrd, status: "APPROVED" }}
        currentUserId={currentUserId}
        onDeleted={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when status is SUBMITTED", () => {
    const { container } = render(
      <DeletePrdButton
        prd={{ ...draftOwnerPrd, status: "SUBMITTED" }}
        currentUserId={currentUserId}
        onDeleted={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when user is not the owner", () => {
    const { container } = render(
      <DeletePrdButton
        prd={draftOwnerPrd}
        currentUserId="user_2"
        onDeleted={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a button for Draft PRD owned by current user", () => {
    render(
      <DeletePrdButton
        prd={draftOwnerPrd}
        currentUserId={currentUserId}
        onDeleted={jest.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /delete/i });
    expect(button).toBeInTheDocument();
  });

  it("opens the confirm modal when the delete button is clicked", () => {
    render(
      <DeletePrdButton
        prd={draftOwnerPrd}
        currentUserId={currentUserId}
        onDeleted={jest.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(button);

    // Modal should appear with the PRD title in the heading
    expect(screen.getByText(/My Draft PRD/)).toBeInTheDocument();
  });

  it("does not open modal before button is clicked", () => {
    render(
      <DeletePrdButton
        prd={draftOwnerPrd}
        currentUserId={currentUserId}
        onDeleted={jest.fn()}
      />,
    );

    expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument();
  });
});
