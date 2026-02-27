"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";

export interface ProjectCardProps {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

export function ProjectCard({ id, name, description, memberCount }: ProjectCardProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(`/projects/${id}`);
  }, [router, id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        router.push(`/projects/${id}`);
      }
    },
    [router, id],
  );

  return (
    <article
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="article"
      aria-label={`Project: ${name}`}
    >
      <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{description}</p>
      <div className="mt-4 flex items-center text-sm text-gray-500">
        <svg
          className="mr-1.5 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span>
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
      </div>
    </article>
  );
}
