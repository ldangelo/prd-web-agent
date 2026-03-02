"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme, type ThemePreference } from "./ThemeProvider";

export function ThemeSync() {
  const { data: session } = useSession();
  const { setPreference } = useTheme();

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/theme")
      .then((r) => r.json())
      .then(({ data }: { data: { themePreference: ThemePreference } }) => {
        if (data?.themePreference) {
          setPreference(data.themePreference);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(session?.user as { id?: string } | undefined)?.id]);

  return null;
}
