"use client";

import React, { useState, useCallback } from "react";
import { RepoPicker } from "./RepoPicker";
import type { RepoSelection } from "./RepoPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface ProjectFormData {
  name: string;
  description: string;
  githubRepo: string;
  defaultLabels: string[];
  defaultReviewers: string[];
}

export interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => void;
  isLoading: boolean;
}

const emptyForm: ProjectFormData = {
  name: "",
  description: "",
  githubRepo: "",
  defaultLabels: [],
  defaultReviewers: [],
};

export function ProjectForm({ initialData, onSubmit, isLoading }: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    ...emptyForm,
    ...initialData,
  });

  const [labelsInput, setLabelsInput] = useState(
    (initialData?.defaultLabels ?? []).join(", "),
  );
  const [reviewersInput, setReviewersInput] = useState(
    (initialData?.defaultReviewers ?? []).join(", "),
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleRepoChange = useCallback((repo: RepoSelection | null) => {
    setFormData((prev) => ({
      ...prev,
      githubRepo: repo ? repo.fullName : "",
    }));
  }, []);

  const handleLabelsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLabelsInput(raw);
      const labels = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      setFormData((prev) => ({ ...prev, defaultLabels: labels }));
    },
    [],
  );

  const handleReviewersChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setReviewersInput(raw);
      const reviewers = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      setFormData((prev) => ({ ...prev, defaultReviewers: reviewers }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    },
    [formData, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          name="name"
          type="text"
          required
          value={formData.name}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <fieldset className="rounded-md border border-border p-4">
        <legend className="px-2 text-sm font-medium text-muted-foreground">
          GitHub Settings
        </legend>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-githubRepo">GitHub Repository</Label>
            <div>
              <RepoPicker
                value={formData.githubRepo || undefined}
                onChange={handleRepoChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-defaultLabels">Default Labels</Label>
            <Input
              id="project-defaultLabels"
              name="defaultLabels"
              type="text"
              placeholder="bug, enhancement, prd"
              value={labelsInput}
              onChange={handleLabelsChange}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of labels
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-defaultReviewers">Default Reviewers</Label>
            <Input
              id="project-defaultReviewers"
              name="defaultReviewers"
              type="text"
              placeholder="user1, user2"
              value={reviewersInput}
              onChange={handleReviewersChange}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of GitHub usernames
            </p>
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
