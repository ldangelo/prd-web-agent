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
    <div className="w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          aria-label="Mark all as read"
        >
          Mark all as read
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          No notifications
        </div>
      ) : (
        <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
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
