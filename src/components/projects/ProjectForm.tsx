"use client";

import React, { useState, useCallback } from "react";
import { RepoPicker } from "./RepoPicker";
import type { RepoSelection } from "./RepoPicker";

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
      <div>
        <label
          htmlFor="project-name"
          className="block text-sm font-medium text-gray-700"
        >
          Name
        </label>
        <input
          id="project-name"
          name="name"
          type="text"
          required
          value={formData.name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="project-description"
          className="block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          id="project-description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <fieldset className="rounded-md border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium text-gray-700">
          GitHub Settings
        </legend>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="project-githubRepo"
              className="block text-sm font-medium text-gray-700"
            >
              GitHub Repository
            </label>
            <div className="mt-1">
              <RepoPicker
                value={formData.githubRepo || undefined}
                onChange={handleRepoChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="project-defaultLabels"
              className="block text-sm font-medium text-gray-700"
            >
              Default Labels
            </label>
            <input
              id="project-defaultLabels"
              name="defaultLabels"
              type="text"
              placeholder="bug, enhancement, prd"
              value={labelsInput}
              onChange={handleLabelsChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated list of labels
            </p>
          </div>

          <div>
            <label
              htmlFor="project-defaultReviewers"
              className="block text-sm font-medium text-gray-700"
            >
              Default Reviewers
            </label>
            <input
              id="project-defaultReviewers"
              name="defaultReviewers"
              type="text"
              placeholder="user1, user2"
              value={reviewersInput}
              onChange={handleReviewersChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated list of GitHub usernames
            </p>
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
