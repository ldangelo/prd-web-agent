import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "../NotificationBell";

// Mock Radix Dropdown portal to render inline for tests
jest.mock("@radix-ui/react-dropdown-menu", () => {
  const actual = jest.requireActual("@radix-ui/react-dropdown-menu");
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("NotificationBell", () => {
  it("renders bell icon button", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, notifications: [] }),
    });

    render(<NotificationBell />);

    expect(
      screen.getByRole("button", { name: /notifications/i })
    ).toBeInTheDocument();
  });

  it("shows unread count badge when there are unread notifications", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 5,
        notifications: [],
      }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  it("does not show badge when unread count is zero", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, notifications: [] }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });

  it("provides screen reader text for unread count", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 3,
        notifications: [],
      }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("3 unread notifications")).toBeInTheDocument();
    });
  });

  it("uses singular form for single unread notification", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        notifications: [],
      }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("1 unread notification")).toBeInTheDocument();
    });
  });

  it("opens dropdown on click and shows notifications", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        notifications: [
          {
            id: "n1",
            type: "comment",
            message: "New comment on PRD",
            read: false,
            createdAt: "2026-01-15T10:00:00Z",
          },
        ],
      }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /notifications/i })
    );

    await waitFor(() => {
      expect(screen.getByText("New comment on PRD")).toBeInTheDocument();
    });
  });
});
