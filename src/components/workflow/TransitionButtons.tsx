"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export interface TransitionButtonsProps {
  currentStatus: string;
  onTransition: (toStatus: string, comment?: string) => void;
}

interface TransitionOption {
  label: string;
  toStatus: string;
  requiresComment: boolean;
  variant: "primary" | "danger" | "success";
}

const transitionMap: Record<string, TransitionOption[]> = {
  Draft: [
    {
      label: "Submit for Review",
      toStatus: "In Review",
      requiresComment: false,
      variant: "primary",
    },
  ],
  "In Review": [
    {
      label: "Approve",
      toStatus: "Approved",
      requiresComment: false,
      variant: "success",
    },
    {
      label: "Reject",
      toStatus: "Draft",
      requiresComment: true,
      variant: "danger",
    },
  ],
  Approved: [
    {
      label: "Submit",
      toStatus: "Submitted",
      requiresComment: false,
      variant: "primary",
    },
  ],
};

const variantMap: Record<string, "default" | "destructive" | "outline"> = {
  primary: "default",
  danger: "destructive",
  success: "default",
};

export function TransitionButtons({
  currentStatus,
  onTransition,
}: TransitionButtonsProps) {
  const [pendingTransition, setPendingTransition] =
    useState<TransitionOption | null>(null);
  const pendingRef = useRef<TransitionOption | null>(null);
  const [comment, setComment] = useState("");

  const transitions = transitionMap[currentStatus];

  if (!transitions || transitions.length === 0) {
    return null;
  }

  const handleConfirm = () => {
    // Use ref to avoid race with Radix AlertDialog's onOpenChange clearing state
    const transition = pendingRef.current;
    if (!transition) return;
    onTransition(
      transition.toStatus,
      transition.requiresComment ? comment : undefined
    );
    pendingRef.current = null;
    setPendingTransition(null);
    setComment("");
  };

  const handleCancel = () => {
    pendingRef.current = null;
    setPendingTransition(null);
    setComment("");
  };

  return (
    <div className="flex gap-2">
      {transitions.map((transition) => (
        <Button
          key={transition.toStatus}
          type="button"
          variant={variantMap[transition.variant]}
          size="sm"
          onClick={() => {
            pendingRef.current = transition;
            setPendingTransition(transition);
          }}
          className={
            transition.variant === "success"
              ? "bg-green-600 text-white hover:bg-green-500"
              : undefined
          }
        >
          {transition.label}
        </Button>
      ))}

      <AlertDialog
        open={!!pendingTransition}
        onOpenChange={(open) => {
          if (!open) setPendingTransition(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm transition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the status to{" "}
              <strong>{pendingTransition?.toStatus}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingTransition?.requiresComment && (
            <div className="space-y-2">
              <Label htmlFor="transition-comment">Comment (required)</Label>
              <Textarea
                id="transition-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                aria-label="Rejection comment"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleConfirm}
              disabled={
                pendingTransition?.requiresComment
                  ? comment.trim() === ""
                  : false
              }
              aria-label="Confirm transition"
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
