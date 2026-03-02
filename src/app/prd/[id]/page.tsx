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

import { useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { DocumentTab } from "@/components/prd/DocumentTab";
import { VersionHistory } from "@/components/prd/VersionHistory";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { TransitionButtons } from "@/components/workflow/TransitionButtons";
import { SubmissionModal } from "@/components/submission/SubmissionModal";
import { usePrdGeneration } from "@/hooks/usePrdGeneration";

// ---------------------------------------------------------------------------
// Status mapping: Prisma enum ↔ display strings used by workflow components
// ---------------------------------------------------------------------------

const STATUS_TO_DISPLAY: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
};

const DISPLAY_TO_STATUS: Record<string, string> = {
  Draft: "DRAFT",
  "In Review": "IN_REVIEW",
  Approved: "APPROVED",
  Submitted: "SUBMITTED",
};

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
  const [refinePrompt, setRefinePrompt] = useState<string | null>(null);

  const [submissionOpen, setSubmissionOpen] = useState(false);

  const {
    content: documentContent,
    title,
    status,
    isGenerating,
    streamingText,
    error: generationError,
    refreshContent,
  } = usePrdGeneration(prdId);

  const displayStatus = STATUS_TO_DISPLAY[status] ?? "Draft";

  const handleTransition = useCallback(
    async (toDisplayStatus: string, comment?: string) => {
      const enumValue = DISPLAY_TO_STATUS[toDisplayStatus];
      if (!enumValue) return;

      // "Submitted" opens the submission modal instead of a simple status change
      if (enumValue === "SUBMITTED") {
        setSubmissionOpen(true);
        return;
      }

      try {
        const res = await fetch(`/api/prds/${prdId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: enumValue, comment }),
        });
        if (!res.ok) {
          throw new Error(`Status transition failed: ${res.status}`);
        }
        await refreshContent();
      } catch (err: any) {
        console.error("Transition error:", err.message);
      }
    },
    [prdId, refreshContent],
  );

  const handleSubmissionClose = useCallback(() => {
    setSubmissionOpen(false);
    void refreshContent();
  }, [refreshContent]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    router.replace(`/prd/${prdId}?tab=${tab.toLowerCase()}`);
  }

  function handleRefine() {
    setRefinePrompt(
      `Please review this PRD and provide a structured analysis:\n\n` +
      `1. **Completeness** — Are any standard sections missing or thin?\n` +
      `2. **Clarity** — Are requirements specific and measurable?\n` +
      `3. **Consistency** — Are there any contradictions or conflicts?\n` +
      `4. **Feasibility** — Are there any unrealistic requirements?\n\n` +
      `After your analysis, ask me which improvements I'd like to make.`,
    );
    setActiveTab("Chat");
    router.replace(`/prd/${prdId}?tab=chat`);
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={displayStatus} />
          <h1 className="text-2xl font-bold">{title || "PRD Detail"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <TransitionButtons
            currentStatus={displayStatus}
            onTransition={(toStatus, comment) =>
              void handleTransition(toStatus, comment)
            }
          />
          {status === "DRAFT" && (
            <button
              onClick={handleRefine}
              disabled={isGenerating}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              Refine
            </button>
          )}
        </div>
      </div>

      <SubmissionModal
        prdId={prdId}
        isOpen={submissionOpen}
        onClose={handleSubmissionClose}
      />

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
              initialPrompt={refinePrompt ?? undefined}
              onPrdSaved={() => {
                setRefinePrompt(null);
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
