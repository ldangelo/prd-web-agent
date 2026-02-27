import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationDropdown } from "../NotificationDropdown";
import type { NotificationData } from "@/types/notifications";

const mockNotifications: NotificationData[] = [
  {
    id: "n1",
    type: "comment",
    message: "Alice commented on your PRD",
    prdId: "prd-1",
    read: false,
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "n2",
    type: "status",
    message: "PRD moved to In Review",
    prdId: "prd-2",
    read: true,
    createdAt: "2026-01-14T09:00:00Z",
  },
];

describe("NotificationDropdown", () => {
  it("renders notification list", () => {
    render(
      <NotificationDropdown
        notifications={mockNotifications}
        onMarkRead={jest.fn()}
        onMarkAllRead={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

    expect(
      screen.getByText("Alice commented on your PRD")
    ).toBeInTheDocument();
    expect(
      screen.getByText("PRD moved to In Review")
    ).toBeInTheDocument();
  });

  it("calls onMarkRead when a notification is clicked", async () => {
    const user = userEvent.setup();
    const onMarkRead = jest.fn();
    const onNavigate = jest.fn();

    render(
      <NotificationDropdown
        notifications={mockNotifications}
        onMarkRead={onMarkRead}
        onMarkAllRead={jest.fn()}
        onNavigate={onNavigate}
      />
    );

    await user.click(screen.getByText("Alice commented on your PRD"));

    expect(onMarkRead).toHaveBeenCalledWith("n1");
    expect(onNavigate).toHaveBeenCalledWith("prd-1");
  });

  it("shows mark all as read button", () => {
    render(
      <NotificationDropdown
        notifications={mockNotifications}
        onMarkRead={jest.fn()}
        onMarkAllRead={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /mark all as read/i })
    ).toBeInTheDocument();
  });

  it("calls onMarkAllRead when mark all as read is clicked", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = jest.fn();

    render(
      <NotificationDropdown
        notifications={mockNotifications}
        onMarkRead={jest.fn()}
        onMarkAllRead={onMarkAllRead}
        onNavigate={jest.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /mark all as read/i })
    );

    expect(onMarkAllRead).toHaveBeenCalled();
  });

  it("shows unread indicator for unread notifications", () => {
    render(
      <NotificationDropdown
        notifications={mockNotifications}
        onMarkRead={jest.fn()}
        onMarkAllRead={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-unread", "true");
    expect(items[1]).toHaveAttribute("data-unread", "false");
  });
});
