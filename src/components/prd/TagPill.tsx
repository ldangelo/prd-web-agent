"use client";

import React from "react";

export interface TagPillProps {
  /** The tag text to display */
  tag: string;
  /** Callback when the remove button is clicked */
  onRemove?: () => void;
  /** Whether to show the remove button */
  removable?: boolean;
}

/**
 * Simple tag display component rendered as a small rounded pill.
 */
export function TagPill({ tag, onRemove, removable = false }: TagPillProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      <span>{tag}</span>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          aria-label={`Remove ${tag}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}
