"use client";

/**
 * PRD detail page with tab navigation.
 *
 * Tabs: Document, Chat, Comments, History
 * The Chat tab connects to the agent WebSocket for interactive refinement.
 * The Document tab renders the PRD markdown with a table of contents sidebar.
 * The History tab shows version history with the ability to view past versions.
 */

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { DocumentTab } from "@/components/prd/DocumentTab";
import { VersionHistory } from "@/components/prd/VersionHistory";

const TABS = ["Document", "Chat", "Comments", "History"] as const;
type Tab = (typeof TABS)[number];

export default function PrdDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const prdId = params?.id as string;

  const initialTab = (searchParams?.get("tab") as Tab) || "Document";
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "Document",
  );
  const [isRefining, setIsRefining] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>("");

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    router.replace(`/prd/${prdId}?tab=${tab.toLowerCase()}`);
  }

  async function handleRefine() {
    setIsRefining(true);
    try {
      const res = await fetch(`/api/prds/${prdId}/refine`, {
        method: "POST",
      });
      if (res.ok) {
        setActiveTab("Chat");
        router.replace(`/prd/${prdId}?tab=chat`);
      }
    } catch {
      // Handle error silently for now
    } finally {
      setIsRefining(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">PRD Detail</h1>
        <button
          onClick={handleRefine}
          disabled={isRefining}
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isRefining ? "Loading..." : "Refine"}
        </button>
      </div>

      {/* Tab navigation */}
      <div className="mt-6 border-b" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4" role="tabpanel">
        {activeTab === "Document" && (
          <DocumentTab content={documentContent} />
        )}

        {activeTab === "Chat" && (
          <div>
            <p className="text-gray-600">
              Chat interface for agent interaction will load here.
            </p>
            {/* Session resume prompt placeholder */}
            <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                If you have an existing session for this PRD, you can resume it.
              </p>
              <button className="mt-2 rounded bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700">
                Resume Session
              </button>
            </div>
          </div>
        )}

        {activeTab === "Comments" && (
          <div>
            <p className="text-gray-600">
              Comments and review feedback will appear here.
            </p>
          </div>
        )}

        {activeTab === "History" && (
          <VersionHistory
            prdId={prdId}
            onVersionSelect={(content) => {
              setDocumentContent(content);
              handleTabChange("Document");
            }}
          />
        )}
      </div>
    </main>
  );
}
