"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, X, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parsePdpSheet, buildColumnRoleView, guessOverallContextColumns } from "@/lib/pdp-sheet";
import { PDP_CATALOG } from "@/lib/pdp-catalog";
import type { VTONStore } from "@/store/vton-store";

const PREVIEW_ROWS = 6;

/**
 * Sheet upload, SKU mapping and preview for the PDP Set mode.
 *
 * Two deliberate behaviours here:
 *
 *  - Original header names are shown verbatim everywhere. Nothing is renamed, normalised
 *    or prettified, so the operator always recognises their own file.
 *  - The sheet routinely carries more products than were uploaded. Rows matching no
 *    subfolder are reported and ignored rather than treated as an error, and products
 *    with no row keep empty fields and still generate from image analysis alone.
 *
 * Per option column assignment lives on the shots step, authored from each option's own
 * card. What this panel adds is the inverse view: which roles each column ends up serving,
 * so coverage can be checked without walking every option.
 */
export function PdpSheetPanel({ store }: { store: VTONStore }) {
  const {
    pdpSheetSession,
    setPdpSheetSession,
    pdpSheetSummary,
    pdpOptionColumns,
    pdpCustomOptions,
    pdpResolvedProducts,
  } = store;

  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (inputRef.current) inputRef.current.value = "";
      if (!file) return;

      setBusy(true);
      setError(null);
      try {
        const { session, errors } = await parsePdpSheet(file);
        if (!session) {
          setError(errors[0] ?? "Could not read this file.");
          return;
        }
        setPdpSheetSession(session);
        setError(errors.length > 0 ? errors[0] : null);
      } catch {
        setError("Could not read this file.");
      } finally {
        setBusy(false);
      }
    },
    [setPdpSheetSession]
  );

  // Re-match whenever the mapping changes so the product cards stay truthful.
  const setSku = useCallback(
    (header: string) => {
      if (!pdpSheetSession) return;
      setPdpSheetSession({
        ...pdpSheetSession,
        skuColumn: header,
        overallContextColumns: guessOverallContextColumns(pdpSheetSession.headers, header),
      });
    },
    [pdpSheetSession, setPdpSheetSession]
  );

  const toggleContext = useCallback(
    (header: string) => {
      if (!pdpSheetSession) return;
      const has = pdpSheetSession.overallContextColumns.includes(header);
      setPdpSheetSession({
        ...pdpSheetSession,
        overallContextColumns: has
          ? pdpSheetSession.overallContextColumns.filter((h) => h !== header)
          : [...pdpSheetSession.overallContextColumns, header],
      });
    },
    [pdpSheetSession, setPdpSheetSession]
  );

  const roleView = useMemo(
    () => buildColumnRoleView(pdpSheetSession, pdpOptionColumns, [...PDP_CATALOG, ...pdpCustomOptions]),
    [pdpSheetSession, pdpOptionColumns, pdpCustomOptions]
  );

  if (!pdpSheetSession) {
    return (
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Product information sheet</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Excel or CSV. One column holds the SKU codes that match your subfolder names.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {busy ? "Reading..." : "Upload Excel / CSV"}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          onChange={handleFile}
          className="hidden"
        />
      </section>
    );
  }

  const { headers, records, skuColumn, overallContextColumns } = pdpSheetSession;
  const dataHeaders = headers.filter((h) => h !== skuColumn);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Product information sheet</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pdpSheetSession.fileName} · {records.length} row{records.length === 1 ? "" : "s"} ·{" "}
            {headers.length} column{headers.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => {
            setPdpSheetSession(null);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <X className="w-3 h-3" />
          Detach
        </button>
      </div>

      {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}

      {/* SKU column */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">SKU column</span>
        <Select value={skuColumn} onValueChange={setSku}>
          <SelectTrigger className="h-8 w-56 text-xs">
            <SelectValue placeholder="Choose the SKU column" />
          </SelectTrigger>
          <SelectContent>
            {headers.map((h) => (
              <SelectItem key={h} value={h} className="text-xs">
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">matched against subfolder names</span>
      </div>

      {/* Match summary */}
      {pdpSheetSummary && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs text-foreground flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            {pdpSheetSummary.matched} of {pdpResolvedProducts.length} product
            {pdpResolvedProducts.length === 1 ? "" : "s"} matched a row
          </p>
          {pdpSheetSummary.unmatchedProducts.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              <span>
                No sheet row for {pdpSheetSummary.unmatchedProducts.join(", ")}. These generate from
                the product images alone.
              </span>
            </p>
          )}
          {pdpSheetSummary.unmatchedRows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {pdpSheetSummary.unmatchedRows.length} sheet row
              {pdpSheetSummary.unmatchedRows.length === 1 ? "" : "s"} matched no uploaded folder and{" "}
              {pdpSheetSummary.unmatchedRows.length === 1 ? "was" : "were"} ignored.
            </p>
          )}
        </div>
      )}

      {/* Overall context columns */}
      <div className="space-y-2">
        <div>
          <p className="text-xs font-medium text-foreground">Overall context</p>
          <p className="text-xs text-muted-foreground">
            These columns inform every image in the set: the setting, the props, the palette and
            product accuracy. They are also the fallback for any option with no column of its own.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dataHeaders.map((h) => {
            const active = overallContextColumns.includes(h);
            return (
              <button
                key={h}
                onClick={() => toggleContext(h)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/60"
                )}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sheet preview, original headers preserved */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">Sheet preview</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 font-medium",
                      h === skuColumn
                        ? "text-primary"
                        : overallContextColumns.includes(h)
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {h}
                    {h === skuColumn && <span className="ml-1 text-[10px] font-normal">SKU</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.slice(0, PREVIEW_ROWS).map((row, i) => (
                <tr key={i} className="border-t border-border/60">
                  {headers.map((h) => (
                    <td
                      key={h}
                      className="max-w-[16rem] truncate px-3 py-1.5 text-muted-foreground"
                      title={row[h] ?? ""}
                    >
                      {row[h] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length > PREVIEW_ROWS && (
          <p className="text-xs text-muted-foreground">
            Showing the first {PREVIEW_ROWS} of {records.length} rows.
          </p>
        )}
      </div>

      {/* Inverse view of the per-option mapping */}
      {roleView.some((r) => r.roles.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">What each column feeds</p>
          <div className="rounded-xl border border-border divide-y divide-border/60">
            {roleView.map(({ header, roles }) => (
              <div key={header} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="text-xs font-medium text-foreground min-w-[8rem]">{header}</span>
                {roles.length === 0 ? (
                  <span className="text-xs text-muted-foreground/60">not used</span>
                ) : (
                  roles.map((role) => (
                    <span
                      key={role}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {role}
                    </span>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
