/**
 * Tests for the root page redirect logic.
 *
 * The home page is a server component that redirects authenticated
 * users to /dashboard and unauthenticated users to /login.
 */
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth/auth";
import Home from "../page";

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockRedirect = redirect as unknown as jest.MockedFunction<
  (url: string) => never
>;

describe("Home page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should redirect authenticated users to /dashboard", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", email: "a@b.com", name: "Test", role: "AUTHOR" },
      expires: "",
    } as any);

    await Home();

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should redirect unauthenticated users to /login", async () => {
    mockAuth.mockResolvedValue(null as any);

    await Home();

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
