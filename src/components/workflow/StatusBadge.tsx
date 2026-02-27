"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
}

const statusVariantMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string; label?: string }> = {
  Draft: { variant: "outline" },
  "In Review": { variant: "secondary" },
  Approved: { variant: "default", className: "bg-green-600 hover:bg-green-600/80" },
  Submitted: { variant: "default", className: "bg-blue-600 hover:bg-blue-600/80" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusVariantMap[status] ?? { variant: "outline" as const };

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      {status}
    </Badge>
  );
}
