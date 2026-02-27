"use client";

import React, { useCallback, useEffect, useState } from "react";

interface IntegrationSettings {
  confluence: {
    url: string;
    email: string;
    space: string;
    token: string;
  };
  jira: {
    url: string;
    email: string;
    project: string;
    token: string;
  };
  git: {
    repo: string;
    token: string;
  };
  beads: {
    project: string;
  };
}

interface LlmSettings {
  provider: string;
  model: string;
  thinkingLevel: string;
}

interface WorkflowSettings {
  blockApprovalOnUnresolved: boolean;
}

interface Settings {
  confluence: IntegrationSettings["confluence"];
  jira: IntegrationSettings["jira"];
  git: IntegrationSettings["git"];
  beads: IntegrationSettings["beads"];
  llm: LlmSettings;
  workflow: WorkflowSettings;
}

const DEFAULT_SETTINGS: Settings = {
  confluence: { url: "", email: "", space: "", token: "" },
  jira: { url: "", email: "", project: "", token: "" },
  git: { repo: "", token: "" },
  beads: { project: "" },
  llm: { provider: "anthropic", model: "", thinkingLevel: "medium" },
  workflow: { blockApprovalOnUnresolved: false },
};

/**
 * Admin settings page for configuring integrations, LLM, and workflow.
 *
 * Fetches settings from /api/admin/settings and saves via PUT.
 */
export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateField = useCallback(
    <K extends keyof Settings>(
      section: K,
      field: string,
      value: string | boolean,
    ) => {
      setSettings((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] as Record<string, unknown>),
          [field]: value,
        },
      }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveMessage("Settings saved successfully.");
      } else {
        setSaveMessage("Failed to save settings.");
      }
    } catch {
      setSaveMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-gray-500">Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Admin Settings</h1>

      {/* Confluence */}
      <section className="mb-8 rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Confluence
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="confluence-url"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confluence URL
            </label>
            <input
              id="confluence-url"
              type="url"
              value={settings.confluence.url}
              onChange={(e) => updateField("confluence", "url", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="confluence-email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confluence Email
            </label>
            <input
              id="confluence-email"
              type="email"
              value={settings.confluence.email}
              onChange={(e) =>
                updateField("confluence", "email", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="confluence-space"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confluence Space
            </label>
            <input
              id="confluence-space"
              type="text"
              value={settings.confluence.space}
              onChange={(e) =>
                updateField("confluence", "space", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="confluence-token"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confluence Token
            </label>
            <input
              id="confluence-token"
              type="password"
              value={settings.confluence.token}
              onChange={(e) =>
                updateField("confluence", "token", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Jira */}
      <section className="mb-8 rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Jira</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="jira-url"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Jira URL
            </label>
            <input
              id="jira-url"
              type="url"
              value={settings.jira.url}
              onChange={(e) => updateField("jira", "url", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="jira-email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Jira Email
            </label>
            <input
              id="jira-email"
              type="email"
              value={settings.jira.email}
              onChange={(e) => updateField("jira", "email", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="jira-project"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Jira Project
            </label>
            <input
              id="jira-project"
              type="text"
              value={settings.jira.project}
              onChange={(e) => updateField("jira", "project", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="jira-token"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Jira Token
            </label>
            <input
              id="jira-token"
              type="password"
              value={settings.jira.token}
              onChange={(e) => updateField("jira", "token", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Git */}
      <section className="mb-8 rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Git</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="git-repo"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Git Repository
            </label>
            <input
              id="git-repo"
              type="url"
              value={settings.git.repo}
              onChange={(e) => updateField("git", "repo", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="git-token"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Git Token
            </label>
            <input
              id="git-token"
              type="password"
              value={settings.git.token}
              onChange={(e) => updateField("git", "token", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Beads */}
      <section className="mb-8 rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Beads</h2>
        <div>
          <label
            htmlFor="beads-project"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Beads Project
          </label>
          <input
            id="beads-project"
            type="text"
            value={settings.beads.project}
            onChange={(e) => updateField("beads", "project", e.target.value)}
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* LLM Settings */}
      <section className="mb-8 rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          LLM Settings
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="llm-provider"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Provider
            </label>
            <select
              id="llm-provider"
              value={settings.llm.provider}
              onChange={(e) => updateField("llm", "provider", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="llm-model"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Model
            </label>
            <input
              id="llm-model"
              type="text"
              value={settings.llm.model}
              onChange={(e) => updateField("llm", "model", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="llm-thinking-level"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Thinking Level
            </label>
            <select
              id="llm-thinking-level"
              value={settings.llm.thinkingLevel}
              onChange={(e) =>
                updateField("llm", "thinkingLevel", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </section>

      {/* Workflow Settings */}
      <section className="mb-8 rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Workflow Settings
        </h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.workflow.blockApprovalOnUnresolved}
            onChange={(e) =>
              updateField(
                "workflow",
                "blockApprovalOnUnresolved",
                e.target.checked,
              )
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Block approval on unresolved comments
          </span>
        </label>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saveMessage && (
          <span
            className={`text-sm ${saveMessage.includes("success") ? "text-green-600" : "text-red-600"}`}
          >
            {saveMessage}
          </span>
        )}
      </div>
    </main>
  );
}
