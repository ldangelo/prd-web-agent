"use client";

import React from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "./NavLinks";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  links: NavLink[];
  userName?: string | null;
}

export function MobileNav({ links, userName }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-[rgb(var(--nav-foreground))] opacity-60 hover:bg-[rgb(var(--nav-item-hover))] hover:opacity-100"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-[rgb(var(--nav-background))] p-0 border-[rgb(var(--nav-item-hover))]">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-[rgb(var(--nav-foreground))] text-lg font-semibold">
            PRD Agent
          </SheetTitle>
        </SheetHeader>
        <NavLinks links={links} userName={userName} mobile />
      </SheetContent>
    </Sheet>
  );
}
