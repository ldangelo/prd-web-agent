import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageComposer } from "../MessageComposer";

describe("MessageComposer", () => {
  it("renders input and send button", () => {
    render(<MessageComposer onSend={jest.fn()} disabled={false} />);

    expect(
      screen.getByPlaceholderText(/type a message/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("calls onSend with text when submitted", async () => {
    const onSend = jest.fn();
    render(<MessageComposer onSend={onSend} disabled={false} />);

    const input = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(input, "Hello agent");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith("Hello agent", undefined);
  });

  it("disables input when disabled prop is true", () => {
    render(<MessageComposer onSend={jest.fn()} disabled={true} />);

    expect(screen.getByPlaceholderText(/type a message/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("clears input after send", async () => {
    const onSend = jest.fn();
    render(<MessageComposer onSend={onSend} disabled={false} />);

    const input = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(input, "Hello agent");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(input).toHaveValue("");
  });

  it("does not send empty messages", async () => {
    const onSend = jest.fn();
    render(<MessageComposer onSend={onSend} disabled={false} />);

    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("has an image attachment input", () => {
    render(<MessageComposer onSend={jest.fn()} disabled={false} />);

    const fileInput = screen.getByLabelText(/attach image/i);
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });
});
