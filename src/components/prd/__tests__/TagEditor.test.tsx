/**
 * TagEditor component tests.
 *
 * Tests for the tag editor with add/remove functionality.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagEditor } from "../TagEditor";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("TagEditor", () => {
  const defaultProps = {
    prdId: "prd_001",
    initialTags: ["feature", "design"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tags: [] } }),
    });
  });

  it("renders existing tags", () => {
    render(<TagEditor {...defaultProps} />);
    expect(screen.getByText("feature")).toBeInTheDocument();
    expect(screen.getByText("design")).toBeInTheDocument();
  });

  it("renders an input field for adding tags", () => {
    render(<TagEditor {...defaultProps} />);
    expect(screen.getByPlaceholderText(/add tag/i)).toBeInTheDocument();
  });

  it("adds a new tag on Enter", async () => {
    const onTagsChange = jest.fn();
    render(<TagEditor {...defaultProps} onTagsChange={onTagsChange} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, "security{Enter}");

    expect(screen.getByText("security")).toBeInTheDocument();
    expect(onTagsChange).toHaveBeenCalledWith([
      "feature",
      "design",
      "security",
    ]);
  });

  it("clears the input after adding a tag", async () => {
    render(<TagEditor {...defaultProps} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, "security{Enter}");

    expect(input).toHaveValue("");
  });

  it("removes a tag when remove button is clicked", async () => {
    const onTagsChange = jest.fn();
    render(<TagEditor {...defaultProps} onTagsChange={onTagsChange} />);

    // Each tag should have a remove button
    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[0]);

    expect(screen.queryByText("feature")).not.toBeInTheDocument();
    expect(onTagsChange).toHaveBeenCalledWith(["design"]);
  });

  it("does not add duplicate tags", async () => {
    render(<TagEditor {...defaultProps} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, "feature{Enter}");

    // Should still only have one "feature" tag
    const featureTags = screen.getAllByText("feature");
    expect(featureTags).toHaveLength(1);
  });

  it("does not add empty tags", async () => {
    const onTagsChange = jest.fn();
    render(<TagEditor {...defaultProps} onTagsChange={onTagsChange} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, "   {Enter}");

    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("calls PUT API when tags change", async () => {
    render(<TagEditor {...defaultProps} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, "new-tag{Enter}");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/prds/prd_001/tags",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          tags: ["feature", "design", "new-tag"],
        }),
      }),
    );
  });
});
