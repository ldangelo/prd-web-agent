"use client";

import React from "react";
import { Loader2 } from "lucide-react";

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
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>Running {toolName}...</span>
    </div>
  );
}
