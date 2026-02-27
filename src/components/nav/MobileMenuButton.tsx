"use client";

import { useState } from "react";
import { X, Menu } from "lucide-react";
import { NavLinks } from "./NavLinks";

interface NavLink {
  href: string;
  label: string;
}

interface MobileMenuButtonProps {
  links: NavLink[];
  userName?: string | null;
}

export function MobileMenuButton({ links, userName }: MobileMenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
        aria-expanded={isOpen}
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full bg-gray-800 sm:hidden">
          <NavLinks links={links} userName={userName} mobile />
        </div>
      )}
    </>
  );
}
