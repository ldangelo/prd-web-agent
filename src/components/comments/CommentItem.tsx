"use client";

import React from "react";
import type { CommentData } from "@/types/comments";

export interface CommentItemProps {
  comment: CommentData;
  onResolve: (commentId: string) => void;
  showResolve: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CommentItem({ comment, onResolve, showResolve }: CommentItemProps) {
  return (
    <div className="flex gap-3 py-3">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700"
        aria-hidden="true"
      >
        {getInitials(comment.authorName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {comment.authorName}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>

        <p className="mt-1 text-sm text-gray-700">{comment.body}</p>

        {showResolve && (
          <button
            type="button"
            onClick={() => onResolve(comment.id)}
            className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
              comment.resolved
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            aria-label={comment.resolved ? "Unresolve comment" : "Resolve comment"}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
            {comment.resolved ? "Unresolve" : "Resolve"}
          </button>
        )}
      </div>
    </div>
  );
}
