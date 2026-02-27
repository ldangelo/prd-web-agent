"use client";

import React from "react";

export interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  "In Review": "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Submitted: "bg-blue-100 text-blue-800",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] ?? "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {status}
    </span>
  );
}
