"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="article"
      aria-label={`Project: ${name}`}
    >
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center text-sm text-muted-foreground">
          <Users className="mr-1.5 h-4 w-4" aria-hidden="true" />
          <span>
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
