"use client";

import React, { useState } from "react";

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

const variantStyles: Record<string, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500",
  danger:
    "bg-red-600 text-white hover:bg-red-500",
  success:
    "bg-green-600 text-white hover:bg-green-500",
};

export function TransitionButtons({
  currentStatus,
  onTransition,
}: TransitionButtonsProps) {
  const [pendingTransition, setPendingTransition] =
    useState<TransitionOption | null>(null);
  const [comment, setComment] = useState("");

  const transitions = transitionMap[currentStatus];

  if (!transitions || transitions.length === 0) {
    return null;
  }

  const handleConfirm = () => {
    if (!pendingTransition) return;
    onTransition(
      pendingTransition.toStatus,
      pendingTransition.requiresComment ? comment : undefined
    );
    setPendingTransition(null);
    setComment("");
  };

  const handleCancel = () => {
    setPendingTransition(null);
    setComment("");
  };

  return (
    <div className="flex gap-2">
      {transitions.map((transition) => (
        <button
          key={transition.toStatus}
          type="button"
          onClick={() => setPendingTransition(transition)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium shadow-sm ${
            variantStyles[transition.variant]
          }`}
        >
          {transition.label}
        </button>
      ))}

      {pendingTransition && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm transition"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <p className="text-sm text-gray-700">
              Are you sure you want to change the status to{" "}
              <strong>{pendingTransition.toStatus}</strong>?
            </p>

            {pendingTransition.requiresComment && (
              <div className="mt-4">
                <label
                  htmlFor="transition-comment"
                  className="block text-sm font-medium text-gray-700"
                >
                  Comment (required)
                </label>
                <textarea
                  id="transition-comment"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  aria-label="Rejection comment"
                />
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={
                  pendingTransition.requiresComment && comment.trim() === ""
                }
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                aria-label="Confirm transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
