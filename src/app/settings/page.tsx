"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROVIDER_DEFAULTS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openrouter: "anthropic/claude-sonnet-4",
  openai: "gpt-4o",
};

interface LlmSettings {
  provider: string;
  model: string;
  hasApiKey: boolean;
}

export default function SettingsPage() {
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/user/llm-settings");
      const json = await res.json();
      if (json.data) {
        const data = json.data as LlmSettings;
        setProvider(data.provider);
        setModel(data.model);
        setHasApiKey(data.hasApiKey);
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/llm-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model || PROVIDER_DEFAULTS[provider],
          apiKey,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to save settings");
      }

      setHasApiKey(true);
      setApiKey("");
      setMessage({ type: "success", text: "Settings saved successfully" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/llm-settings", { method: "DELETE" });

      if (!res.ok) {
        throw new Error("Failed to clear settings");
      }

      setProvider("anthropic");
      setModel("");
      setApiKey("");
      setHasApiKey(false);
      setMessage({
        type: "success",
        text: "Settings cleared — using global defaults",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to clear settings",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleProviderChange(value: string) {
    setProvider(value);
    setModel(PROVIDER_DEFAULTS[value] || "");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">LLM Settings</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">LLM Settings</h1>
      <p className="mb-6 text-sm text-gray-500">
        Configure your own LLM provider and API key. If not set, the global
        defaults will be used.
      </p>

      <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Provider */}
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={PROVIDER_DEFAULTS[provider]}
          />
          <p className="text-xs text-gray-400">
            Leave blank to use the default for the selected provider
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? "••••••••  (key saved)" : "Enter your API key"}
          />
          {hasApiKey && !apiKey && (
            <p className="text-xs text-green-600">
              Key saved. Enter a new value to replace it.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || !apiKey}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {hasApiKey && (
            <Button variant="outline" onClick={handleClear} disabled={saving}>
              Clear settings
            </Button>
          )}
        </div>

        {/* Message */}
        {message && (
          <p
            className={`text-sm ${
              message.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
