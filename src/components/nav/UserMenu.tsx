"use client";

import { signOut } from "next-auth/react";

interface UserMenuProps {
  userName?: string | null;
  userImage?: string | null;
}

export function UserMenu({ userName, userImage }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      {userImage ? (
        <img
          src={userImage}
          alt=""
          className="h-8 w-8 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 text-sm font-medium text-white">
          {userName?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
      )}
      <span className="hidden text-sm text-gray-300 lg:block">{userName}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
