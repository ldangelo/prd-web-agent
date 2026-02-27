"use client";

import React, { useState } from "react";

export interface CommentComposerProps {
  onSubmit: (body: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CommentComposer({
  onSubmit,
  placeholder = "Add a comment...",
  disabled = false,
}: CommentComposerProps) {
  const [body, setBody] = useState("");

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setBody("");
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="comment-composer" className="sr-only">
        Comment
      </label>
      <textarea
        id="comment-composer"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50"
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={disabled}
        rows={3}
        aria-label="Comment"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || body.trim().length === 0}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Submit comment"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
