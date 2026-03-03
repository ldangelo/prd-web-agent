/**
 * DeletePrdButton — Trash icon button that opens the deletion confirmation modal.
 *
 * Renders null (not just invisible) when:
 *   - the PRD status is not DRAFT, OR
 *   - the current user is not the PRD author.
 *
 * When visible it opens DeletePrdConfirmModal on click. On confirmed deletion
 * it calls the `deletePrd` API helper and invokes `onDeleted`.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeletePrdConfirmModal } from "./DeletePrdConfirmModal";
import { deletePrd } from "@/lib/api/prds";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeletePrdButtonProps {
  prd: { id: string; title: string; status: string; author: { id: string } };
  currentUserId: string;
  onDeleted: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeletePrdButton({
  prd,
  currentUserId,
  onDeleted,
}: DeletePrdButtonProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Guard: only Draft PRDs owned by the current user can be deleted.
  if (prd.status !== "DRAFT" || prd.author.id !== currentUserId) {
    return null;
  }

  async function handleConfirm() {
    setIsDeleting(true);
    try {
      await deletePrd(prd.id);
      setModalOpen(false);
      toast.success(`'${prd.title}' deleted.`);
      onDeleted(prd.id);
      router.push("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete PRD.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancel() {
    setModalOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${prd.title}`}
        onClick={(e) => {
          // Prevent the row click handler from navigating to the PRD detail page.
          e.stopPropagation();
          setModalOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
      </Button>

      <DeletePrdConfirmModal
        open={modalOpen}
        prdTitle={prd.title}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isDeleting={isDeleting}
      />
    </>
  );
}
