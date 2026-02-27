import React from "react";
import { render, screen } from "@testing-library/react";
import { ChatInterface } from "../ChatInterface";

describe("ChatInterface", () => {
  it("renders all sub-components", () => {
    render(<ChatInterface sessionId="test-session" />);

    // Message list empty state
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();

    // Message composer
    expect(
      screen.getByPlaceholderText(/type a message/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("shows message composer", () => {
    render(<ChatInterface sessionId="test-session" />);

    expect(
      screen.getByPlaceholderText(/type a message/i),
    ).toBeInTheDocument();
  });

  it("renders with null sessionId", () => {
    render(<ChatInterface sessionId={null} />);

    expect(
      screen.getByPlaceholderText(/type a message/i),
    ).toBeInTheDocument();
  });
});
