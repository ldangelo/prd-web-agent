"use client";

/**
 * PRD detail page with tab navigation.
 *
 * Tabs: Document, Chat, Comments, History
 * The Chat tab connects to the agent WebSocket for interactive refinement.
 * The Document tab renders the PRD markdown with a table of contents sidebar.
 * The History tab shows version history with the ability to view past versions.
 *
 * On load, if the PRD is being generated, shows a streaming preview with
 * a progress indicator until generation completes.
 */

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { DocumentTab } from "@/components/prd/DocumentTab";
import { VersionHistory } from "@/components/prd/VersionHistory";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { usePrdGeneration } from "@/hooks/usePrdGeneration";

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

  const {
    content: documentContent,
    isGenerating,
    streamingText,
    error: generationError,
    refreshContent,
  } = usePrdGeneration(prdId);

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
          disabled={isRefining || isGenerating}
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
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4" role="tabpanel">
        {activeTab === "Document" && (
          <>
            {/* Generation error state */}
            {generationError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">
                  Generation failed: {generationError}
                </p>
                <button
                  onClick={() => void refreshContent()}
                  className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Generation in progress */}
            {isGenerating && (
              <div className="mb-4">
                <div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="text-sm font-medium text-blue-800">
                    Generating PRD content...
                  </span>
                </div>
                {/* Streaming preview */}
                {streamingText && (
                  <div className="mt-3 rounded border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {streamingText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Document content */}
            {!isGenerating && (
              <DocumentTab content={documentContent} />
            )}
          </>
        )}

        {activeTab === "Chat" && (
          <div className="h-[600px]">
            <ChatInterface
              prdId={prdId}
              projectId=""
              userId=""
              mode="refine"
              onPrdSaved={() => {
                void refreshContent();
              }}
            />
          </div>
        )}

        {activeTab === "Comments" && (
          <div>
            <p className="text-muted-foreground">
              Comments and review feedback will appear here.
            </p>
          </div>
        )}

        {activeTab === "History" && (
          <VersionHistory
            prdId={prdId}
            onVersionSelect={(content) => {
              handleTabChange("Document");
              // Content will be shown after tab switch via refreshContent
              void refreshContent();
            }}
          />
        )}
      </div>
    </main>
  );
}
