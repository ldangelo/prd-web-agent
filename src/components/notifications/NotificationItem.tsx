"use client";

import React from "react";
import type { NotificationData } from "@/types/notifications";

export interface NotificationItemProps {
  notification: NotificationData;
  onMarkRead: (id: string) => void;
  onClick: (notification: NotificationData) => void;
}

function getTypeIcon(type: string): string {
  switch (type) {
    case "comment":
      return "\uD83D\uDCAC";
    case "status":
      return "\uD83D\uDD04";
    case "mention":
      return "@";
    default:
      return "\uD83D\uDD14";
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationItem({
  notification,
  onMarkRead,
  onClick,
}: NotificationItemProps) {
  const handleClick = () => {
    onMarkRead(notification.id);
    onClick(notification);
  };

  return (
    <li
      data-unread={String(!notification.read)}
      className={`cursor-pointer px-4 py-3 transition-colors hover:bg-muted ${
        !notification.read ? "bg-accent" : ""
      }`}
      onClick={handleClick}
      role="listitem"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-sm" aria-hidden="true">
          {getTypeIcon(notification.type)}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm ${
              !notification.read
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {notification.message}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatTimestamp(notification.createdAt)}
          </p>
        </div>
        {!notification.read && (
          <span
            className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
            aria-label="Unread"
          />
        )}
      </div>
    </li>
  );
}
