"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Undo2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseSpreadsheetFile } from "@/lib/bulk-spreadsheet-import";
import {
  applySheetToFolders,
  buildSheetIndex,
  guessInfographicMapping,
  SHEET_MAP_NONE,
  validateInfographicMapping,
} from "@/lib/infographic-sheet-import";
import { cn } from "@/lib/utils";
import type { VTONStore } from "@/store/vton-store";
import type { InfographicSheetMapping } from "@/lib/types";

/** Data rows shown in the mapping dialog's preview table. */
const PREVIEW_ROW_COUNT = 5;
/** Cap on names listed inside the summary bar's disclosures. */
const MAX_LISTED = 25;

/**
 * Upload button + column-mapping dialog for the infographic callout spreadsheet.
 *
 * Parsing is reused wholesale from the VTON bulk importer (`parseSpreadsheetFile`); this is the
 * leaner sibling of `BulkSpreadsheetImportSection` in step-garments.tsx — no image downloading,
 * no row filtering, three columns to map.
 */
export function InfographicSheetImportButton({ store }: { store: VTONStore }) {
  const {
    infographicFolders,
    patchInfographicFolders,
    setInfographicSheetSession,
    setInfographicSheetImport,
  } = store;

  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const [skuCol, setSkuCol] = useState("");
  const [minCol, setMinCol] = useState(SHEET_MAP_NONE);
  const [soleCol, setSoleCol] = useState(SHEET_MAP_NONE);

  const mapping: InfographicSheetMapping = useMemo(
    () => ({
      skuColumn: skuCol,
      minimalisticColumn: minCol === SHEET_MAP_NONE ? null : minCol,
      soleConstructionColumn: soleCol === SHEET_MAP_NONE ? null : soleCol,
    }),
    [skuCol, minCol, soleCol]
  );

  const mappingError = useMemo(
    () => (headers.length > 0 ? validateInfographicMapping(mapping, headers) : null),
    [mapping, headers]
  );

  /** Dry run against the current products, so the button can promise a real number. */
  const preview = useMemo(() => {
    if (mappingError || headers.length === 0) return null;
    return applySheetToFolders(infographicFolders, buildSheetIndex(records, mapping));
  }, [mappingError, headers, infographicFolders, records, mapping]);

  /** header → which of the three roles it is mapped to, for column highlighting. */
  const roleByHeader = useMemo(() => {
    const roles = new Map<string, string>();
    if (mapping.skuColumn) roles.set(mapping.skuColumn, "SKU");
    if (mapping.minimalisticColumn) roles.set(mapping.minimalisticColumn, "Minimalistic");
    if (mapping.soleConstructionColumn) roles.set(mapping.soleConstructionColumn, "Sole");
    return roles;
  }, [mapping]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";

    setIsParsing(true);
    setParseErrors([]);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.headers.length === 0 || parsed.records.length === 0) {
        setParseErrors(
          parsed.errors.length > 0 ? parsed.errors : ["Could not read any rows from this file."]
        );
        setIsParsing(false);
        return;
      }

      const guess = guessInfographicMapping(parsed.headers);
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRecords(parsed.records);
      setParseErrors(parsed.errors);
      setSkuCol(guess.skuColumn);
      setMinCol(guess.minimalisticColumn ?? SHEET_MAP_NONE);
      setSoleCol(guess.soleConstructionColumn ?? SHEET_MAP_NONE);
      setOpen(true);
    } catch (err) {
      setParseErrors([(err as Error).message || "Failed to read file"]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    patchInfographicFolders(preview.patches);
    setInfographicSheetImport({
      fileName,
      filledCount: preview.filledCount,
      unmatchedSkus: preview.unmatchedSkus,
      unfilledProducts: preview.unfilledProducts,
      snapshot: preview.snapshot,
    });
    setInfographicSheetSession({ fileName, headers, records, mapping });
    setOpen(false);
  }, [
    preview,
    patchInfographicFolders,
    setInfographicSheetImport,
    setInfographicSheetSession,
    fileName,
    headers,
    records,
    mapping,
  ]);

  const previewRows = records.slice(0, PREVIEW_ROW_COUNT);

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isParsing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
        title="Fill callout text for every product from a spreadsheet"
      >
        {isParsing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5" />
        )}
        Upload Excel / CSV
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.tsv,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Parse failures surface outside the dialog, since the dialog never opened. */}
      {!open && parseErrors.length > 0 && headers.length === 0 && (
        <p className="text-[11px] text-destructive">{parseErrors[0]}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Map spreadsheet columns</DialogTitle>
            <DialogDescription>
              Rows are matched to products by SKU against the product name (case, spaces and
              dashes are ignored). Callout text is imported exactly as written.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Product SKU</Label>
                <Select value={skuCol} onValueChange={setSkuCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">✨ Minimalistic callouts</Label>
                <Select value={minCol} onValueChange={setMinCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    <SelectItem value={SHEET_MAP_NONE}>None</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">🧱 Sole construction</Label>
                <Select value={soleCol} onValueChange={setSoleCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    <SelectItem value={SHEET_MAP_NONE}>None</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview: header + first N data rows, all columns. */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Preview
                  <span className="font-normal text-muted-foreground ml-1.5">
                    first {Math.min(PREVIEW_ROW_COUNT, records.length)} of {records.length} rows
                  </span>
                </Label>
                <span className="text-[10px] text-muted-foreground">{fileName}</span>
              </div>
              <div className="rounded-lg border border-border overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {headers.map((h) => {
                        const role = roleByHeader.get(h);
                        return (
                          <th
                            key={h}
                            className={cn(
                              "text-left font-medium px-2.5 py-2 border-b border-border whitespace-nowrap",
                              role ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {h}
                            {role && (
                              <span className="ml-1.5 text-[9px] uppercase tracking-wide opacity-70">
                                {role}
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-b-0">
                        {headers.map((h) => (
                          <td
                            key={h}
                            title={row[h] || ""}
                            className={cn(
                              "px-2.5 py-1.5 align-top text-foreground/80",
                              roleByHeader.has(h) && "bg-primary/[0.04]"
                            )}
                          >
                            <div className="max-w-[240px] truncate">{row[h] || ""}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {parseErrors.length > 0 && (
              <ul className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1">
                {parseErrors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-[11px] text-amber-600 dark:text-amber-400">
                    {err}
                  </li>
                ))}
                {parseErrors.length > 5 && (
                  <li className="text-[11px] text-muted-foreground">
                    ...and {parseErrors.length - 5} more warnings
                  </li>
                )}
              </ul>
            )}
          </div>

          {mappingError ? (
            <p className="text-xs text-destructive shrink-0">{mappingError}</p>
          ) : preview && preview.filledCount === 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
              No product names match a SKU in this sheet. Rename your products to their SKU codes,
              or check the SKU column.
            </p>
          ) : null}

          <DialogFooter className="shrink-0">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!preview || preview.filledCount === 0}
              className="btn-gradient rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {preview && preview.filledCount > 0
                ? `Fill ${preview.filledCount} product${preview.filledCount === 1 ? "" : "s"}`
                : "Import"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NameList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground marker:text-muted-foreground">
        {names.length} {label}
      </summary>
      <div className="mt-1 flex flex-wrap gap-1">
        {names.slice(0, MAX_LISTED).map((n, i) => (
          <span
            key={`${n}-${i}`}
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {n || "(unnamed)"}
          </span>
        ))}
        {names.length > MAX_LISTED && (
          <span className="text-[10px] text-muted-foreground self-center">
            +{names.length - MAX_LISTED} more
          </span>
        )}
      </div>
    </details>
  );
}

/**
 * Status bar for the last import: what was filled, what was missed, undo, and the attached-sheet
 * chip. Rendered under the Products header while an import result exists.
 */
export function InfographicSheetSummaryBar({ store }: { store: VTONStore }) {
  const {
    infographicSheetImport,
    setInfographicSheetImport,
    infographicSheetSession,
    patchInfographicFolders,
    clearInfographicSheet,
  } = store;

  const summary = infographicSheetImport;

  const handleUndo = useCallback(() => {
    if (!summary) return;
    patchInfographicFolders(summary.snapshot);
    setInfographicSheetImport(null);
  }, [summary, patchInfographicFolders, setInfographicSheetImport]);

  if (!summary && !infographicSheetSession) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 text-xs text-foreground">
          <FileSpreadsheet className="w-3.5 h-3.5 text-primary shrink-0" />
          {summary ? (
            <span>
              <strong className="font-medium">{summary.filledCount}</strong>{" "}
              product{summary.filledCount === 1 ? "" : "s"} filled from{" "}
              <span className="text-muted-foreground">{summary.fileName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              <span className="text-foreground">{infographicSheetSession?.fileName}</span> attached
              — products you add next will fill automatically
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {summary && summary.snapshot.length > 0 && (
            <button
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Undo2 className="w-3 h-3" />
              Undo import
            </button>
          )}
          <button
            onClick={clearInfographicSheet}
            title="Detach spreadsheet"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-3 h-3" />
            Detach
          </button>
        </div>
      </div>

      {summary && (summary.unfilledProducts.length > 0 || summary.unmatchedSkus.length > 0) && (
        <div className="flex flex-wrap items-start gap-x-5 gap-y-1 pl-5">
          <NameList label="products not found in the sheet" names={summary.unfilledProducts} />
          <NameList label="sheet rows unused" names={summary.unmatchedSkus} />
        </div>
      )}
    </div>
  );
}
