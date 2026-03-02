/**
 * Tests for ThemeToggle component.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "../ThemeToggle";
import { ThemeProvider } from "../ThemeProvider";

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThemeToggle", () => {
  it("renders three option buttons", () => {
    renderToggle();
    expect(screen.getByRole("radio", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeInTheDocument();
  });

  it("marks current preference as aria-checked=true", () => {
    renderToggle();
    // Default is SYSTEM
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("clicking DARK calls setPreference(DARK)", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("clicking LIGHT calls setPreference(LIGHT)", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("clicking SYSTEM calls setPreference(SYSTEM)", async () => {
    const user = userEvent.setup();
    localStorage.setItem("theme-preference", "DARK");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("radio", { name: "System" }));
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("is keyboard accessible via Space key", async () => {
    const user = userEvent.setup();
    renderToggle();
    const darkBtn = screen.getByRole("radio", { name: "Dark" });
    darkBtn.focus();
    await user.keyboard(" ");
    expect(darkBtn).toHaveAttribute("aria-checked", "true");
  });

  it("each button has aria-label", () => {
    renderToggle();
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-label",
      "Light",
    );
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-label",
      "Dark",
    );
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-label",
      "System",
    );
  });

  it("container has role=radiogroup", () => {
    renderToggle();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });
});
