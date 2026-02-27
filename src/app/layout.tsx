import type { Metadata } from "next";
import { NavBar } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRD Web Agent",
  description: "AI-powered PRD authoring and management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* @ts-expect-error Async Server Component */}
        <NavBar />
        {children}
      </body>
    </html>
  );
}
