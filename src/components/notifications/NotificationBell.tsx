"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import type { NotificationData } from "@/types/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    fetchNotifications();
  };

  const handleNavigate = (prdId: string) => {
    window.location.href = `/prds/${prdId}`;
  };

  const handleNotificationClick = (notification: NotificationData) => {
    handleMarkRead(notification.id);
    if (notification.prdId) {
      handleNavigate(notification.prdId);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" aria-hidden="true" />

          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
              aria-hidden="true"
            >
              {unreadCount}
            </span>
          )}
          {unreadCount > 0 && (
            <span className="sr-only">
              {unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-medium text-primary hover:text-primary/80"
            aria-label="Mark all as read"
          >
            Mark all as read
          </button>
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`cursor-pointer px-3 py-2.5 ${
                !notification.read ? "bg-accent" : ""
              }`}
              data-unread={String(!notification.read)}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-3 w-full">
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
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
