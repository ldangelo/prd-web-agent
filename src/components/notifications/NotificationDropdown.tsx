"use client";

import React from "react";
import type { NotificationData } from "@/types/notifications";
import { NotificationItem } from "./NotificationItem";

export interface NotificationDropdownProps {
  notifications: NotificationData[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (prdId: string) => void;
}

export function NotificationDropdown({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationDropdownProps) {
  const handleClick = (notification: NotificationData) => {
    if (notification.prdId) {
      onNavigate(notification.prdId);
    }
  };

  return (
    <div className="w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-medium text-primary hover:text-primary/80"
          aria-label="Mark all as read"
        >
          Mark all as read
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No notifications
        </div>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={onMarkRead}
              onClick={handleClick}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
