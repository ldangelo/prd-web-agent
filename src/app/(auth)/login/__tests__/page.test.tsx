import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../page";

// Mock next-auth/react
const mockSignIn = jest.fn();
jest.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockSignIn.mockClear();
  });

  it("renders the Sign In heading", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a 'Sign in with GitHub' button", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: /sign in with github/i }),
    ).toBeInTheDocument();
  });

  it("does not reference Google anywhere", () => {
    render(<LoginPage />);

    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
  });

  it("calls signIn with 'github' provider when button is clicked", async () => {
    render(<LoginPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /sign in with github/i }),
    );

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledWith("github", {
      callbackUrl: "/dashboard",
    });
  });

  it("passes callbackUrl from search params to signIn", async () => {
    // Override useSearchParams for this test
    const useSearchParamsMock = jest.requireMock("next/navigation").useSearchParams;
    const originalImpl = useSearchParamsMock;
    jest.spyOn(
      jest.requireMock("next/navigation") as { useSearchParams: () => URLSearchParams },
      "useSearchParams",
    ).mockReturnValue(new URLSearchParams("callbackUrl=/projects"));

    render(<LoginPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /sign in with github/i }),
    );

    expect(mockSignIn).toHaveBeenCalledWith("github", {
      callbackUrl: "/projects",
    });
  });

  it("renders the GitHub SVG icon (Octicon mark)", () => {
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /sign in with github/i });
    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // GitHub Octicon uses a specific viewBox
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
  });
});
