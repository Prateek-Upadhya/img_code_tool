"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Download,
  Loader2,
  Sparkles,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  LayoutTemplate,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateReplicatePrompt, generateReplicateImage } from "@/lib/gemini";
import type { VTONStore } from "@/store/vton-store";
import type { ReplicateResult, ReplicateBulkResult } from "@/lib/types";

// Replicate images always render on Gemini → fixed cap of 5.
const BULK_CONCURRENCY = 5;

// ─── Status Badge ───

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "error") return <AlertCircle className="w-4 h-4 text-red-500" />;
  if (status === "pending") return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
  return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
}

function statusLabel(status: string) {
  switch (status) {
    case "generating-prompt": return "Generating prompt...";
    case "generating-image": return "Generating image...";
    case "auto-retrying": return "Retrying...";
    case "completed": return "Complete";
    case "error": return "Failed";
    default: return "Pending";
  }
}

// ─── Single Mode Generate ───

function SingleModeGenerate({ store }: { store: VTONStore }) {
  const {
    replicateAssets,
    replicateReference,
    replicateAdditionalInfo,
    aspectRatio,
    apiKey,
    replicateResults,
    setReplicateResults,
    updateReplicateResult,
    isReplicateGenerating,
    setIsReplicateGenerating,
    imageQuality,
  } = store;

  const [showPrompt, setShowPrompt] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (isReplicateGenerating || !apiKey || !replicateReference || replicateAssets.length === 0) return;
    setIsReplicateGenerating(true);

    const resultId = `rep-result-${Date.now()}`;
    const initialResult: ReplicateResult = {
      id: resultId, prompt: "", imageData: "", status: "generating-prompt",
    };
    setReplicateResults([initialResult]);

    const generateOnce = async (isRetry: boolean) => {
      try {
        if (isRetry) {
          updateReplicateResult(resultId, { status: "auto-retrying", error: undefined });
        } else {
          updateReplicateResult(resultId, { status: "generating-prompt" });
        }

        const promptResult = await generateReplicatePrompt({
          apiKey,
          assetImages: replicateAssets.map((a) => a.file),
          referenceOutput: replicateReference.file,
          additionalInfo: replicateAdditionalInfo,
        });

        updateReplicateResult(resultId, {
          prompt: promptResult.text,
          status: "generating-image",
          costBreakdown: { steps: [promptResult.cost], totalCost: promptResult.cost.totalCost },
        });

        const imageResult = await generateReplicateImage({
          apiKey,
          prompt: promptResult.text,
          assetImages: replicateAssets.map((a) => a.file),
          referenceOutput: replicateReference.file,
          aspectRatio,
          imageSize: imageQuality,
        });

        updateReplicateResult(resultId, {
          imageData: imageResult.imageData,
          status: "completed",
          costBreakdown: {
            steps: [promptResult.cost, imageResult.cost],
            totalCost: promptResult.cost.totalCost + imageResult.cost.totalCost,
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (!isRetry) {
          await new Promise((r) => setTimeout(r, 1000));
          await generateOnce(true);
        } else {
          updateReplicateResult(resultId, { status: "error", error: msg });
        }
      }
    };

    try { await generateOnce(false); } finally { setIsReplicateGenerating(false); }
  }, [isReplicateGenerating, apiKey, replicateReference, replicateAssets, replicateAdditionalInfo, aspectRatio, imageQuality, setReplicateResults, updateReplicateResult, setIsReplicateGenerating]);

  const result = replicateResults[0] ?? null;

  return (
    <>
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Generation Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase tracking-wider font-medium">Input Assets</p>
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">{replicateAssets.length} image{replicateAssets.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase tracking-wider font-medium">Reference Layout</p>
            <div className="flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">{replicateReference ? "Uploaded" : "Missing"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase tracking-wider font-medium">Aspect Ratio</p>
            <span className="font-medium text-foreground">{aspectRatio}</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {replicateAssets.map((asset) => (
            <div key={asset.id} className="w-16 h-16 rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.preview} alt={asset.name} className="w-full h-full object-cover" />
            </div>
          ))}
          {replicateReference && (
            <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-primary/50 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={replicateReference.preview} alt="Reference" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-white text-[8px] text-center py-0.5 font-medium">REF</div>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      {(!result || result.status === "error") && (
        <Button
          onClick={handleGenerate}
          disabled={isReplicateGenerating || !apiKey || !replicateReference || replicateAssets.length === 0}
          className="w-full gap-2 rounded-lg h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
        >
          {isReplicateGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : result?.status === "error" ? (
            <><RotateCcw className="w-4 h-4" /> Retry Generation</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate Replicated Image</>
          )}
        </Button>
      )}

      {/* Result Card */}
      {result && <ResultCard result={result} showPrompt={showPrompt} onTogglePrompt={() => setShowPrompt((v) => !v)} onRegenerate={handleGenerate} isGenerating={isReplicateGenerating} />}
    </>
  );
}

// ─── Bulk Mode Generate ───

function BulkModeGenerate({ store }: { store: VTONStore }) {
  const {
    replicateSharedAssets,
    replicateVariableGroups,
    replicateReference,
    replicateAdditionalInfo,
    aspectRatio,
    apiKey,
    replicateBulkResults,
    setReplicateBulkResults,
    updateReplicateBulkResult,
    isReplicateGenerating,
    setIsReplicateGenerating,
    imageQuality,
  } = store;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const validGroups = replicateVariableGroups.filter((g) => g.images.length > 0);
  const sharedFiles = replicateSharedAssets.map((a) => a.file);

  const handleBulkGenerate = useCallback(async () => {
    if (isReplicateGenerating || !apiKey || !replicateReference || validGroups.length === 0) return;
    setIsReplicateGenerating(true);

    const initialResults: ReplicateBulkResult[] = validGroups.map((group) => ({
      id: `rep-bulk-${group.id}-${Date.now()}`,
      groupId: group.id,
      groupName: group.name,
      prompt: "",
      imageData: "",
      status: "pending",
    }));
    setReplicateBulkResults(initialResults);

    const generateForGroup = async (result: ReplicateBulkResult) => {
      const group = validGroups.find((g) => g.id === result.groupId);
      if (!group) return;

      const assetFiles = [...sharedFiles, ...group.images.map((i) => i.file)];

      const generateOnce = async (isRetry: boolean) => {
        try {
          updateReplicateBulkResult(result.id, {
            status: isRetry ? "auto-retrying" : "generating-prompt",
            error: undefined,
          });

          const promptResult = await generateReplicatePrompt({
            apiKey,
            assetImages: assetFiles,
            referenceOutput: replicateReference!.file,
            additionalInfo: replicateAdditionalInfo,
          });

          updateReplicateBulkResult(result.id, {
            prompt: promptResult.text,
            status: "generating-image",
            costBreakdown: { steps: [promptResult.cost], totalCost: promptResult.cost.totalCost },
          });

          const imageResult = await generateReplicateImage({
            apiKey,
            prompt: promptResult.text,
            assetImages: assetFiles,
            referenceOutput: replicateReference!.file,
            aspectRatio,
            imageSize: imageQuality,
          });

          updateReplicateBulkResult(result.id, {
            imageData: imageResult.imageData,
            status: "completed",
            costBreakdown: {
              steps: [promptResult.cost, imageResult.cost],
              totalCost: promptResult.cost.totalCost + imageResult.cost.totalCost,
            },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          if (!isRetry) {
            await new Promise((r) => setTimeout(r, 1000));
            await generateOnce(true);
          } else {
            updateReplicateBulkResult(result.id, { status: "error", error: msg });
          }
        }
      };

      await generateOnce(false);
    };

    // Process with concurrency
    const queue = [...initialResults];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
      while (running.length < BULK_CONCURRENCY && queue.length > 0) {
        const item = queue.shift()!;
        const promise = generateForGroup(item).then(() => {
          running.splice(running.indexOf(promise), 1);
        });
        running.push(promise);
      }
      if (running.length > 0) await Promise.race(running);
    }

    setIsReplicateGenerating(false);
  }, [isReplicateGenerating, apiKey, replicateReference, validGroups, sharedFiles, replicateAdditionalInfo, aspectRatio, imageQuality, setReplicateBulkResults, updateReplicateBulkResult, setIsReplicateGenerating]);

  const handleRetryOne = useCallback(async (resultId: string) => {
    const result = replicateBulkResults.find((r) => r.id === resultId);
    if (!result || result.status !== "error") return;
    const group = validGroups.find((g) => g.id === result.groupId);
    if (!group || !replicateReference) return;

    setIsReplicateGenerating(true);
    const assetFiles = [...sharedFiles, ...group.images.map((i) => i.file)];

    try {
      updateReplicateBulkResult(resultId, { status: "generating-prompt", error: undefined });

      const promptResult = await generateReplicatePrompt({
        apiKey,
        assetImages: assetFiles,
        referenceOutput: replicateReference.file,
        additionalInfo: replicateAdditionalInfo,
      });

      updateReplicateBulkResult(resultId, {
        prompt: promptResult.text,
        status: "generating-image",
        costBreakdown: { steps: [promptResult.cost], totalCost: promptResult.cost.totalCost },
      });

      const imageResult = await generateReplicateImage({
        apiKey,
        prompt: promptResult.text,
        assetImages: assetFiles,
        referenceOutput: replicateReference.file,
        aspectRatio,
        imageSize: imageQuality,
      });

      updateReplicateBulkResult(resultId, {
        imageData: imageResult.imageData,
        status: "completed",
        costBreakdown: {
          steps: [promptResult.cost, imageResult.cost],
          totalCost: promptResult.cost.totalCost + imageResult.cost.totalCost,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateReplicateBulkResult(resultId, { status: "error", error: msg });
    } finally {
      setIsReplicateGenerating(false);
    }
  }, [replicateBulkResults, validGroups, replicateReference, sharedFiles, apiKey, replicateAdditionalInfo, aspectRatio, imageQuality, updateReplicateBulkResult, setIsReplicateGenerating]);

  const completedCount = replicateBulkResults.filter((r) => r.status === "completed").length;
  const errorCount = replicateBulkResults.filter((r) => r.status === "error").length;
  const totalCost = replicateBulkResults.reduce((sum, r) => sum + (r.costBreakdown?.totalCost ?? 0), 0);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <>
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Bulk Generation Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase tracking-wider font-medium">Groups</p>
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">{validGroups.length}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase tracking-wider font-medium">Shared Assets</p>
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-medium text-foreground">{replicateSharedAssets.length}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase tracking-wider font-medium">Reference</p>
            <div className="flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">{replicateReference ? "Uploaded" : "Missing"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase tracking-wider font-medium">Outputs</p>
            <span className="font-medium text-foreground">{validGroups.length} image{validGroups.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      {(replicateBulkResults.length === 0 || (completedCount + errorCount === replicateBulkResults.length && errorCount > 0)) && (
        <Button
          onClick={handleBulkGenerate}
          disabled={isReplicateGenerating || !apiKey || !replicateReference || validGroups.length === 0}
          className="w-full gap-2 rounded-lg h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
        >
          {isReplicateGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating {completedCount}/{validGroups.length}...</>
          ) : replicateBulkResults.length > 0 ? (
            <><RotateCcw className="w-4 h-4" /> Regenerate All</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate {validGroups.length} Image{validGroups.length !== 1 ? "s" : ""}</>
          )}
        </Button>
      )}

      {/* Progress bar */}
      {replicateBulkResults.length > 0 && isReplicateGenerating && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{completedCount + errorCount} / {replicateBulkResults.length} completed</span>
            {totalCost > 0 && <span>${totalCost.toFixed(4)}</span>}
          </div>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${((completedCount + errorCount) / replicateBulkResults.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results by group */}
      {replicateBulkResults.length > 0 && (
        <div className="space-y-3">
          {replicateBulkResults.map((result) => {
            const isExpanded = expandedGroups.has(result.id);

            return (
              <div key={result.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => toggleGroup(result.id)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={result.status} />
                    <span className="text-sm font-medium text-foreground">{result.groupName}</span>
                    <span className="text-[11px] text-muted-foreground">{statusLabel(result.status)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.costBreakdown && (
                      <span className="text-[11px] text-muted-foreground">${result.costBreakdown.totalCost.toFixed(4)}</span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Error */}
                    {result.status === "error" && result.error && (
                      <div className="px-5 py-3 bg-red-500/5 border-b border-red-500/10 flex items-center justify-between">
                        <p className="text-xs text-red-500">{result.error}</p>
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-7 rounded-lg" onClick={() => handleRetryOne(result.id)} disabled={isReplicateGenerating}>
                          <RotateCcw className="w-3 h-3" /> Retry
                        </Button>
                      </div>
                    )}

                    {/* Image */}
                    {result.imageData && (
                      <div className="p-6">
                        <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/png;base64,${result.imageData}`}
                            alt={result.groupName}
                            className="w-full object-contain max-h-[500px]"
                          />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm" variant="outline" className="gap-1.5 rounded-lg text-xs"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = `data:image/png;base64,${result.imageData}`;
                              link.download = `replicate-${result.groupName.replace(/\s+/g, "-").toLowerCase()}.png`;
                              link.click();
                            }}
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Prompt */}
                    {result.prompt && (
                      <div className="px-5 pb-4">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Prompt</p>
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-40 overflow-auto bg-muted/30 rounded-lg p-3">
                          {result.prompt}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {replicateBulkResults.length > 0 && !isReplicateGenerating && completedCount > 0 && (
        <div className={cn("rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between")}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">
              {completedCount} of {replicateBulkResults.length} generated
              {errorCount > 0 ? ` (${errorCount} failed)` : ""}
            </span>
          </div>
          {totalCost > 0 && (
            <span className="text-xs text-muted-foreground">Total: ${totalCost.toFixed(4)}</span>
          )}
        </div>
      )}
    </>
  );
}

// ─── Result Card (Single mode) ───

function ResultCard({
  result,
  showPrompt,
  onTogglePrompt,
  onRegenerate,
  isGenerating,
}: {
  result: ReplicateResult;
  showPrompt: boolean;
  onTogglePrompt: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={result.status} />
          <span className="text-xs font-medium text-foreground">{statusLabel(result.status)}</span>
        </div>
        {result.costBreakdown && (
          <span className="text-[11px] text-muted-foreground">${result.costBreakdown.totalCost.toFixed(4)}</span>
        )}
      </div>

      {result.status === "error" && result.error && (
        <div className="px-5 py-3 bg-red-500/5 border-b border-red-500/10">
          <p className="text-xs text-red-500">{result.error}</p>
        </div>
      )}

      {result.imageData && (
        <div className="p-6">
          <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${result.imageData}`}
              alt="Replicated output"
              className="w-full object-contain max-h-[600px]"
            />
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5 rounded-lg text-xs" onClick={() => {
              const link = document.createElement("a");
              link.href = `data:image/png;base64,${result.imageData}`;
              link.download = `replicate-fast-output.png`;
              link.click();
            }}>
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-lg text-xs" onClick={onRegenerate} disabled={isGenerating}>
              <RotateCcw className="w-3.5 h-3.5" /> Regenerate
            </Button>
          </div>
        </div>
      )}

      {result.prompt && (
        <div className="border-t border-border">
          <button onClick={onTogglePrompt} className="w-full px-5 py-2.5 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors">
            <span className="font-medium">Generated Prompt</span>
            {showPrompt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showPrompt && (
            <div className={cn("px-5 pb-4 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-60 overflow-auto")}>
              {result.prompt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export function StepReplicateGenerate({ store }: { store: VTONStore }) {
  const { mode } = store;
  const isBulk = mode === "bulk";

  return (
    <div className="space-y-6">
      {isBulk ? <BulkModeGenerate store={store} /> : <SingleModeGenerate store={store} />}
    </div>
  );
}
