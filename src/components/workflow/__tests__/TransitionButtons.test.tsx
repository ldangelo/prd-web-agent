import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransitionButtons } from "../TransitionButtons";

describe("TransitionButtons", () => {
  it("shows Submit for Review button when status is Draft", () => {
    render(
      <TransitionButtons currentStatus="Draft" onTransition={jest.fn()} />
    );

    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeInTheDocument();
  });

  it("shows Approve and Reject buttons when status is In Review", () => {
    render(
      <TransitionButtons currentStatus="In Review" onTransition={jest.fn()} />
    );

    expect(
      screen.getByRole("button", { name: /approve/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reject/i })
    ).toBeInTheDocument();
  });

  it("shows Submit button when status is Approved", () => {
    render(
      <TransitionButtons currentStatus="Approved" onTransition={jest.fn()} />
    );

    expect(
      screen.getByRole("button", { name: /submit$/i })
    ).toBeInTheDocument();
  });

  it("shows no buttons when status is Submitted", () => {
    render(
      <TransitionButtons currentStatus="Submitted" onTransition={jest.fn()} />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows confirmation dialog before transition", async () => {
    const user = userEvent.setup();

    render(
      <TransitionButtons currentStatus="Draft" onTransition={jest.fn()} />
    );

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      screen.getByText(/are you sure/i)
    ).toBeInTheDocument();
  });

  it("calls onTransition after confirming", async () => {
    const user = userEvent.setup();
    const onTransition = jest.fn();

    render(
      <TransitionButtons currentStatus="Draft" onTransition={onTransition} />
    );

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onTransition).toHaveBeenCalledWith("In Review", undefined);
  });

  it("requires comment input when rejecting", async () => {
    const user = userEvent.setup();
    const onTransition = jest.fn();

    render(
      <TransitionButtons
        currentStatus="In Review"
        onTransition={onTransition}
      />
    );

    await user.click(screen.getByRole("button", { name: /reject/i }));

    const dialog = screen.getByRole("alertdialog");
    const commentInput = within(dialog).getByRole("textbox");
    expect(commentInput).toBeInTheDocument();

    await user.type(commentInput, "Needs more detail");
    await user.click(
      within(dialog).getByRole("button", { name: /confirm/i })
    );

    expect(onTransition).toHaveBeenCalledWith("Draft", "Needs more detail");
  });
});
