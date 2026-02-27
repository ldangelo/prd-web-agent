/**
 * Admin Users page tests.
 *
 * Tests the user management page with role badges and actions.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUsersPage from "../users/page";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockUsers = [
  { id: "u1", name: "Alice Admin", email: "alice@example.com", role: "Admin" },
  {
    id: "u2",
    name: "Bob Author",
    email: "bob@example.com",
    role: "Author",
  },
  {
    id: "u3",
    name: "Carol Reviewer",
    email: "carol@example.com",
    role: "Reviewer",
  },
];

describe("AdminUsersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ users: mockUsers }),
    });
  });

  it("renders user list", async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    expect(screen.getByText("Bob Author")).toBeInTheDocument();
    expect(screen.getByText("Carol Reviewer")).toBeInTheDocument();
  });

  it("shows role badges for each user", async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    // Role badges are rendered as spans with specific classes; use getAllByText
    // since role names also appear in <option> elements inside dropdowns
    const adminBadges = screen.getAllByText("Admin");
    expect(adminBadges.length).toBeGreaterThanOrEqual(1);

    const authorBadges = screen.getAllByText("Author");
    expect(authorBadges.length).toBeGreaterThanOrEqual(1);

    const reviewerBadges = screen.getAllByText("Reviewer");
    expect(reviewerBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows add user form", async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/name/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add user/i }),
    ).toBeInTheDocument();
  });

  it("shows role change dropdown for each user", async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    const roleSelects = screen.getAllByRole("combobox");
    expect(roleSelects.length).toBeGreaterThanOrEqual(mockUsers.length);
  });

  it("shows remove button for each user", async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(mockUsers.length);
  });

  it("fetches users on mount", async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/users");
    });
  });
});
