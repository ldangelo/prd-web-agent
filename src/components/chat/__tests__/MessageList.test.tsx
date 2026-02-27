import React from "react";
import { render, screen } from "@testing-library/react";
import { MessageList } from "../MessageList";
import type { ChatMessage } from "@/types/chat";

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe("MessageList", () => {
  const messages: ChatMessage[] = [
    {
      id: "1",
      role: "user",
      content: "Hello agent",
      timestamp: new Date("2026-01-01T12:00:00Z"),
    },
    {
      id: "2",
      role: "agent",
      content: "Hello user, how can I help?",
      timestamp: new Date("2026-01-01T12:00:05Z"),
    },
  ];

  it("renders messages with correct roles", () => {
    render(<MessageList messages={messages} />);

    expect(screen.getByText("Hello agent")).toBeInTheDocument();
    expect(screen.getByText("Hello user, how can I help?")).toBeInTheDocument();

    // Role indicators
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("renders empty state when no messages", () => {
    render(<MessageList messages={[]} />);

    expect(
      screen.getByText(/no messages yet/i),
    ).toBeInTheDocument();
  });

  it("applies different alignment for user and agent messages", () => {
    render(<MessageList messages={messages} />);

    const userMessage = screen.getByText("Hello agent").closest("[data-role]");
    const agentMessage = screen
      .getByText("Hello user, how can I help?")
      .closest("[data-role]");

    expect(userMessage).toHaveAttribute("data-role", "user");
    expect(agentMessage).toHaveAttribute("data-role", "agent");
  });

  it("displays timestamps", () => {
    const { container } = render(<MessageList messages={messages} />);

    // <time> elements don't have an implicit ARIA role, query by tag
    const timeElements = container.querySelectorAll("time");
    expect(timeElements).toHaveLength(2);
    expect(timeElements[0]).toHaveAttribute("datetime");
    expect(timeElements[1]).toHaveAttribute("datetime");
  });

  it("auto-scrolls container on new messages", () => {
    const scrollIntoViewMock = jest.fn();
    // Mock scrollIntoView on the sentinel element
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(<MessageList messages={messages} />);

    const updatedMessages = [
      ...messages,
      {
        id: "3",
        role: "agent" as const,
        content: "New message",
        timestamp: new Date("2026-01-01T12:00:10Z"),
      },
    ];

    rerender(<MessageList messages={updatedMessages} />);

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
