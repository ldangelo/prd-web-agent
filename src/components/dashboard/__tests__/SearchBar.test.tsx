/**
 * SearchBar component tests.
 *
 * Verifies rendering of search input and debounced callback behavior.
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "../SearchBar";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SearchBar", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should render search input", () => {
    render(<SearchBar onSearch={jest.fn()} />);

    expect(
      screen.getByPlaceholderText("Search PRDs..."),
    ).toBeInTheDocument();
  });

  it("should render search icon", () => {
    render(<SearchBar onSearch={jest.fn()} />);

    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("should debounce search calls by 300ms", async () => {
    const onSearch = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByPlaceholderText("Search PRDs...");
    await user.type(input, "test query");

    // Should not have called yet (within debounce window)
    expect(onSearch).not.toHaveBeenCalled();

    // Advance past debounce timer
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should have called once with final value
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("test query");
  });

  it("should not call onSearch for empty input after clearing", async () => {
    const onSearch = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByPlaceholderText("Search PRDs...");
    await user.type(input, "abc");

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith("abc");
    onSearch.mockClear();

    await user.clear(input);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should call with empty string to clear search
    expect(onSearch).toHaveBeenCalledWith("");
  });
});
