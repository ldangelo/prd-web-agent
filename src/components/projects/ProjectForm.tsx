"use client";

import React, { useState, useCallback } from "react";

export interface ProjectFormData {
  name: string;
  description: string;
  confluenceSpace: string;
  jiraProject: string;
  gitRepo: string;
  beadsProject: string;
}

export interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => void;
  isLoading: boolean;
}

const emptyForm: ProjectFormData = {
  name: "",
  description: "",
  confluenceSpace: "",
  jiraProject: "",
  gitRepo: "",
  beadsProject: "",
};

export function ProjectForm({ initialData, onSubmit, isLoading }: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    ...emptyForm,
    ...initialData,
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
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
          Integration Settings
        </legend>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="project-confluenceSpace"
              className="block text-sm font-medium text-gray-700"
            >
              Confluence Space
            </label>
            <input
              id="project-confluenceSpace"
              name="confluenceSpace"
              type="text"
              value={formData.confluenceSpace}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="project-jiraProject"
              className="block text-sm font-medium text-gray-700"
            >
              Jira Project
            </label>
            <input
              id="project-jiraProject"
              name="jiraProject"
              type="text"
              value={formData.jiraProject}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="project-gitRepo"
              className="block text-sm font-medium text-gray-700"
            >
              Git Repo
            </label>
            <input
              id="project-gitRepo"
              name="gitRepo"
              type="text"
              value={formData.gitRepo}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="project-beadsProject"
              className="block text-sm font-medium text-gray-700"
            >
              Beads Project
            </label>
            <input
              id="project-beadsProject"
              name="beadsProject"
              type="text"
              value={formData.beadsProject}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
