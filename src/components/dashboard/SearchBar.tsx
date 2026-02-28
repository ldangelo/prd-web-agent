/**
 * SearchBar - Debounced search input for the PRD dashboard.
 *
 * Text input with a search icon that debounces user input by 300ms
 * before calling the onSearch callback.
 */
"use client";

import { useRef, useCallback, useState } from "react";
import { Search } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchBar({
  onSearch,
  placeholder = "Search PRDs...",
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        onSearch(newValue);
      }, 300);
    },
    [onSearch],
  );

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
        data-testid="search-icon"
      >
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <input
        type="text"
        className="block w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}
