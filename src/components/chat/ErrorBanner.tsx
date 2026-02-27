"use client";

import React from "react";

interface ErrorBannerProps {
  error: string | null;
  retryable: boolean;
  onRetry: () => void;
}

export function ErrorBanner({ error, retryable, onRetry }: ErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <div
      role="alert"
      className="mx-4 my-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <span>{error}</span>
      {retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-4 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
