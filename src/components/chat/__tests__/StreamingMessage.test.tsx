import React from "react";
import { render, screen } from "@testing-library/react";
import { StreamingMessage } from "../StreamingMessage";

describe("StreamingMessage", () => {
  it("renders accumulated chunks", () => {
    render(
      <StreamingMessage chunks={["Hello ", "world", "!"]} isStreaming={false} />,
    );

    expect(screen.getByText("Hello world!")).toBeInTheDocument();
  });

  it("shows typing indicator when streaming", () => {
    render(<StreamingMessage chunks={["Thinking"]} isStreaming={true} />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent is typing")).toBeInTheDocument();
  });

  it("does not show typing indicator when not streaming", () => {
    render(
      <StreamingMessage chunks={["Done"]} isStreaming={false} />,
    );

    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByLabelText("Agent is typing")).not.toBeInTheDocument();
  });

  it("renders nothing when chunks are empty and not streaming", () => {
    const { container } = render(
      <StreamingMessage chunks={[]} isStreaming={false} />,
    );

    expect(container.textContent).toBe("");
  });

  it("shows only typing indicator when chunks are empty but streaming", () => {
    render(<StreamingMessage chunks={[]} isStreaming={true} />);

    expect(screen.getByLabelText("Agent is typing")).toBeInTheDocument();
  });
});
