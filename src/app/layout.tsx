import type { Metadata } from "next";
import { NavBar } from "@/components/nav";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeSync } from "@/components/theme/ThemeSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRD Web Agent",
  description: "AI-powered PRD authoring and management platform",
};

const themeScript = `(function(){try{var p=localStorage.getItem("theme-preference");var d=p==="DARK"||((!p||p==="SYSTEM")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <ThemeSync />
          {/* @ts-expect-error Async Server Component */}
          <NavBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
