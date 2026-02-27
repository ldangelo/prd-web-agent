"use client";

import React, { useCallback, useEffect, useState } from "react";

interface Settings {
  llmProvider: string;
  llmModel: string;
  llmThinkingLevel: string;
  blockApprovalOnUnresolvedComments: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  llmProvider: "anthropic",
  llmModel: "",
  llmThinkingLevel: "medium",
  blockApprovalOnUnresolvedComments: false,
};

/**
 * Admin settings page for configuring LLM and workflow settings.
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
      .then((json) => {
        const data = json.data ?? json;
        setSettings({
          llmProvider: data.llmProvider ?? DEFAULT_SETTINGS.llmProvider,
          llmModel: data.llmModel ?? DEFAULT_SETTINGS.llmModel,
          llmThinkingLevel:
            data.llmThinkingLevel ?? DEFAULT_SETTINGS.llmThinkingLevel,
          blockApprovalOnUnresolvedComments:
            data.blockApprovalOnUnresolvedComments ??
            DEFAULT_SETTINGS.blockApprovalOnUnresolvedComments,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateField = useCallback(
    <K extends keyof Settings>(field: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
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
        <p className="text-muted-foreground">Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-8 text-2xl font-bold text-foreground">Admin Settings</h1>

      {/* LLM Configuration */}
      <section className="mb-8 rounded-lg border border-border p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          LLM Configuration
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="llm-provider"
              className="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Provider
            </label>
            <select
              id="llm-provider"
              value={settings.llmProvider}
              onChange={(e) => updateField("llmProvider", e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="llm-model"
              className="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Model
            </label>
            <input
              id="llm-model"
              type="text"
              value={settings.llmModel}
              onChange={(e) => updateField("llmModel", e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="llm-thinking-level"
              className="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Thinking Level
            </label>
            <select
              id="llm-thinking-level"
              value={settings.llmThinkingLevel}
              onChange={(e) => updateField("llmThinkingLevel", e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </section>

      {/* Workflow Settings */}
      <section className="mb-8 rounded-lg border border-border p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Workflow Settings
        </h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.blockApprovalOnUnresolvedComments}
            onChange={(e) =>
              updateField("blockApprovalOnUnresolvedComments", e.target.checked)
            }
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <span className="text-sm font-medium text-muted-foreground">
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
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
