"use client";

import React from "react";

interface ToolCallIndicatorProps {
  toolName: string | null;
  isActive: boolean;
}

export function ToolCallIndicator({ toolName, isActive }: ToolCallIndicatorProps) {
  if (!isActive || !toolName) {
    return null;
  }

  return (
    <div
      role="status"
      className="mx-4 my-2 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700"
    >
      <svg
        className="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span>Running {toolName}...</span>
    </div>
  );
}
