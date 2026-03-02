/**
 * DeletePrdConfirmModal — Confirmation dialog before permanently deleting a Draft PRD.
 *
 * Safety features:
 *  - Cancel button receives autoFocus so keyboard users can safely dismiss.
 *  - Delete button is disabled for the first 1 second (accidental-click guard).
 *  - Delete button stays disabled while the deletion request is in-flight.
 */
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeletePrdConfirmModalProps {
  open: boolean;
  prdTitle: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isDeleting: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GUARD_MS = 1000;

export function DeletePrdConfirmModal({
  open,
  prdTitle,
  onConfirm,
  onCancel,
  isDeleting,
}: DeletePrdConfirmModalProps) {
  const [guardActive, setGuardActive] = useState(true);

  // Reset guard every time the modal opens.
  useEffect(() => {
    if (!open) return;

    setGuardActive(true);
    const timer = setTimeout(() => setGuardActive(false), GUARD_MS);
    return () => clearTimeout(timer);
  }, [open]);

  const deleteDisabled = guardActive || isDeleting;

  const titleId = "delete-prd-dialog-title";
  const descId = "delete-prd-dialog-desc";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <DialogHeader>
          <DialogTitle id={titleId}>
            Permanently delete &apos;{prdTitle}&apos;? This cannot be undone.
          </DialogTitle>
          <DialogDescription id={descId}>
            This action is irreversible. The PRD and all its history will be
            permanently removed.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          {/* Cancel is first in DOM and receives autoFocus — the safe default action */}
          <Button
            variant="outline"
            onClick={onCancel}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleteDisabled}
            aria-disabled={deleteDisabled}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
