/**
 * DeletePrdButton component tests.
 *
 * TDD: These tests are written first to drive the implementation.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { DeletePrdButton } from "../DeletePrdButton";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/api/prds", () => ({
  deletePrd: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

import { deletePrd } from "@/lib/api/prds";
import { toast } from "sonner";

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
// Helper: open the modal and advance past the 1-second accidental-click guard
// ---------------------------------------------------------------------------

async function openModalAndAdvanceGuard() {
  // Click the trash button to open the modal
  fireEvent.click(screen.getByRole("button", { name: /delete my draft prd/i }));

  // Advance fake timers past the GUARD_MS (1000ms) so the Delete button is enabled
  act(() => {
    jest.advanceTimersByTime(1100);
  });

  // The Delete button should now be enabled
  const confirmBtn = await screen.findByRole("button", { name: /^delete$/i });
  return confirmBtn;
}

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

  // -------------------------------------------------------------------------
  // handleConfirm — deletion flow (lines 47-61)
  // -------------------------------------------------------------------------

  describe("handleConfirm — successful deletion", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
      mockPush.mockClear();
      (deletePrd as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("calls deletePrd with the PRD id on confirmation", async () => {
      const onDeleted = jest.fn();
      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={onDeleted}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(deletePrd).toHaveBeenCalledWith("prd_001");
      });
    });

    it("calls onDeleted with the PRD id after successful deletion", async () => {
      const onDeleted = jest.fn();

      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={onDeleted}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onDeleted).toHaveBeenCalledWith("prd_001");
      });
    });

    it("shows a success toast after successful deletion", async () => {
      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={jest.fn()}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("My Draft PRD"),
        );
      });
    });

    it("navigates to /dashboard after successful deletion", async () => {
      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={jest.fn()}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("handleConfirm — error handling", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows an error toast when deletePrd rejects with an Error", async () => {
      (deletePrd as jest.Mock).mockRejectedValue(new Error("Network failure"));

      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={jest.fn()}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Network failure");
      });
    });

    it("shows a generic error toast when deletePrd rejects with a non-Error", async () => {
      (deletePrd as jest.Mock).mockRejectedValue("unexpected string error");

      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={jest.fn()}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete PRD.");
      });
    });

    it("does not call onDeleted when deletePrd rejects", async () => {
      const onDeleted = jest.fn();
      (deletePrd as jest.Mock).mockRejectedValue(new Error("Server error"));

      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={onDeleted}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
      expect(onDeleted).not.toHaveBeenCalled();
    });
  });

  describe("handleConfirm — loading state (isDeleting)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows 'Deleting…' text on the confirm button while deletion is in progress", async () => {
      // Create a controlled promise to simulate an in-flight deletion request
      let resolveDelete!: () => void;
      const pendingDelete = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      (deletePrd as jest.Mock).mockReturnValue(pendingDelete);

      render(
        <DeletePrdButton
          prd={draftOwnerPrd}
          currentUserId={currentUserId}
          onDeleted={jest.fn()}
        />,
      );

      const confirmBtn = await openModalAndAdvanceGuard();
      fireEvent.click(confirmBtn);

      // While the deletion is pending, the button label should change to "Deleting…"
      await waitFor(() => {
        expect(screen.getByText("Deleting\u2026")).toBeInTheDocument();
      });

      // Resolve the deletion so async operations settle before test cleanup
      await act(async () => {
        resolveDelete();
      });
    });
  });
});
