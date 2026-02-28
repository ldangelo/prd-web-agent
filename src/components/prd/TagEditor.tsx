"use client";

import React, { useState, useCallback } from "react";
import { TagPill } from "./TagPill";

export interface TagEditorProps {
  /** The PRD ID used for API calls */
  prdId: string;
  /** Initial tags to display */
  initialTags: string[];
  /** Callback invoked when tags change */
  onTagsChange?: (tags: string[]) => void;
}

/**
 * Tag editor component for managing PRD tags.
 *
 * Shows existing tags as removable pills with an input field
 * to add new tags (press Enter to add).
 */
export function TagEditor({
  prdId,
  initialTags,
  onTagsChange,
}: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState("");

  const updateTags = useCallback(
    (newTags: string[]) => {
      setTags(newTags);
      onTagsChange?.(newTags);

      // Persist to API
      fetch(`/api/prds/${prdId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
    },
    [prdId, onTagsChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const trimmed = inputValue.trim();

        // Ignore empty or duplicate
        if (!trimmed || tags.includes(trimmed)) {
          setInputValue("");
          return;
        }

        const newTags = [...tags, trimmed];
        setInputValue("");
        updateTags(newTags);
      }
    },
    [inputValue, tags, updateTags],
  );

  const handleRemove = useCallback(
    (tagToRemove: string) => {
      const newTags = tags.filter((t) => t !== tagToRemove);
      updateTags(newTags);
    },
    [tags, updateTags],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <TagPill
          key={tag}
          tag={tag}
          removable
          onRemove={() => handleRemove(tag)}
        />
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add tag..."
        className="rounded-md border border-input px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
