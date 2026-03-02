"use client";

/**
 * Client-side providers wrapper.
 *
 * Wraps the application with providers that require client-side context,
 * such as the NextAuth SessionProvider which makes the session available
 * to client components via useSession().
 */

import { SessionProvider } from "next-auth/react";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
