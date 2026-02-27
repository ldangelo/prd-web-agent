import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { CommentsList } from "../CommentsList";
import type { CommentData } from "@/types/comments";

const mockComments: CommentData[] = [
  {
    id: "c1",
    authorId: "u1",
    authorName: "Alice",
    body: "First comment",
    resolved: false,
    createdAt: "2026-01-15T10:00:00Z",
    replies: [
      {
        id: "c2",
        authorId: "u2",
        authorName: "Bob",
        body: "Reply to first",
        resolved: false,
        createdAt: "2026-01-15T11:00:00Z",
        replies: [],
      },
    ],
  },
  {
    id: "c3",
    authorId: "u3",
    authorName: "Charlie",
    body: "Second comment",
    resolved: false,
    createdAt: "2026-01-15T12:00:00Z",
    replies: [],
  },
];

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("CommentsList", () => {
  it("renders comment threads after fetching", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockComments,
    });

    render(<CommentsList prdId="prd-1" />);

    await waitFor(() => {
      expect(screen.getByText("First comment")).toBeInTheDocument();
    });
    expect(screen.getByText("Second comment")).toBeInTheDocument();
    expect(screen.getByText("Reply to first")).toBeInTheDocument();
  });

  it("shows the new comment composer", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<CommentsList prdId="prd-1" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/add a comment/i)
      ).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<CommentsList prdId="prd-1" />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
