import { parseSpreadsheetFile } from "./bulk-spreadsheet-import";
import { normalizeSkuKey } from "./infographic-sheet-import";
import { stripDashes } from "./pdp-directives";
import type { PdpOptionColumns, PdpProduct, PdpSheetSession, PdpShotOption } from "./types";

/**
 * Spreadsheet handling for the PDP Set mode.
 *
 * File parsing is reused wholesale from `bulk-spreadsheet-import.ts`, which already
 * handles xlsx via SheetJS, csv and tsv via delimiter sniffing, hyperlink cells, and CSV
 * rows split by commas inside CDN URLs. SKU normalisation is reused from
 * `infographic-sheet-import.ts`.
 *
 * What is specific here is the mapping model. A sheet column can serve two distinct jobs
 * at once:
 *
 *   1. OVERALL CONTEXT. Its content informs general product understanding, so it shapes
 *      the scene, the prop choices, the palette reasoning and product fidelity on EVERY
 *      generated image, whatever the heading.
 *   2. OPTION COPY. Its points become the literal on-image bullet callouts for one or
 *      more specific shot options.
 *
 * The same column commonly does both. A `tech_summary` column might inform every image in
 * the set while also supplying the verbatim layer labels for the sole construction
 * infographic. The mapping is therefore many to many in both directions, and is authored
 * from the option's side in the shot picker with an inverse view offered on the sheet
 * panel for checking coverage.
 *
 * Original header names are preserved verbatim everywhere. Nothing is renamed or
 * normalised for display, so the operator always recognises their own sheet.
 */

/** Sentinel for "no column mapped". Radix Select forbids empty string item values. */
export const PDP_SHEET_NONE = "__none__";

export interface PdpSheetParseResult {
  session: PdpSheetSession | null;
  errors: string[];
}

function findHeader(headers: string[], patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const hit = headers.find((h) => re.test(h));
    if (hit) return hit;
  }
  return null;
}

/**
 * Best effort guess at the SKU column so the usual sheet needs one confirming click.
 * Falls back to the first column, which is right more often than not.
 */
export function guessSkuColumn(headers: string[]): string {
  return (
    findHeader(headers, [
      /\bsku\b/i,
      /style.?(code|no|number|id)/i,
      /article/i,
      /product.?(code|id)/i,
      /\bcode\b/i,
      /product.?name/i,
    ]) ??
    headers[0] ??
    ""
  );
}

/**
 * Guess which columns carry general product information. Everything that looks like
 * descriptive prose is offered as overall context by default, because feeding too much
 * context is harmless while feeding none leaves the model guessing at the product.
 */
export function guessOverallContextColumns(headers: string[], skuColumn: string): string[] {
  const patterns = [
    /desc/i,
    /detail/i,
    /feature/i,
    /\busp\b/i,
    /highlight/i,
    /spec/i,
    /material/i,
    /tech/i,
    /about/i,
    /info/i,
    /benefit/i,
  ];
  return headers.filter((h) => h !== skuColumn && patterns.some((re) => re.test(h)));
}

export async function parsePdpSheet(file: File): Promise<PdpSheetParseResult> {
  const parsed = await parseSpreadsheetFile(file);
  if (parsed.headers.length === 0) {
    return { session: null, errors: parsed.errors.length ? parsed.errors : ["No columns found in this file."] };
  }
  const skuColumn = guessSkuColumn(parsed.headers);
  return {
    session: {
      fileName: file.name,
      headers: parsed.headers,
      records: parsed.records,
      skuColumn,
      overallContextColumns: guessOverallContextColumns(parsed.headers, skuColumn),
    },
    errors: parsed.errors,
  };
}

/** SKU key to row. First row wins on a duplicate SKU, matching the existing importer. */
export function buildPdpSheetIndex(session: PdpSheetSession): Map<string, Record<string, string>> {
  const index = new Map<string, Record<string, string>>();
  for (const record of session.records) {
    const key = normalizeSkuKey(record[session.skuColumn] ?? "");
    if (!key || index.has(key)) continue;
    index.set(key, record);
  }
  return index;
}

export interface PdpSheetMatchSummary {
  /** Products that found a row. */
  matched: number;
  /** Product SKUs with no row in the sheet. Their fields stay empty. */
  unmatchedProducts: string[];
  /** Sheet SKUs matching no uploaded subfolder. Ignored entirely. */
  unmatchedRows: string[];
}

/**
 * Attach sheet rows to products by SKU.
 *
 * A sheet routinely carries more products than were uploaded. Rows matching nothing are
 * ignored rather than treated as an error, and products matching nothing keep an absent
 * `sheetRow` and still generate from image analysis alone.
 */
export function applyPdpSheet(
  products: PdpProduct[],
  session: PdpSheetSession | null
): { products: PdpProduct[]; summary: PdpSheetMatchSummary } {
  if (!session) {
    return {
      products: products.map((p) => ({ ...p, sheetRow: undefined })),
      summary: { matched: 0, unmatchedProducts: products.map((p) => p.sku), unmatchedRows: [] },
    };
  }

  const index = buildPdpSheetIndex(session);
  const usedKeys = new Set<string>();
  const unmatchedProducts: string[] = [];

  const next = products.map((product) => {
    const key = normalizeSkuKey(product.sku);
    const row = index.get(key);
    if (row) {
      usedKeys.add(key);
      return { ...product, sheetRow: row };
    }
    unmatchedProducts.push(product.sku);
    return { ...product, sheetRow: undefined };
  });

  const unmatchedRows: string[] = [];
  for (const record of session.records) {
    const raw = (record[session.skuColumn] ?? "").trim();
    const key = normalizeSkuKey(raw);
    if (!key || usedKeys.has(key)) continue;
    if (!unmatchedRows.includes(raw)) unmatchedRows.push(raw);
  }

  return {
    products: next,
    summary: { matched: next.length - unmatchedProducts.length, unmatchedProducts, unmatchedRows },
  };
}

function joinCells(row: Record<string, string> | undefined, columns: string[]): string {
  if (!row) return "";
  return columns
    .map((c) => (row[c] ?? "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export interface PdpResolvedCopy {
  /** General product understanding. Feeds every generation in the set. */
  overallContext: string;
  /** Copy for this specific option's on-image callouts. */
  optionCopy: string;
  /** True when optionCopy fell back to overallContext because no column was mapped. */
  usedFallback: boolean;
}

/**
 * Resolve the two copy channels for one product and one option.
 *
 * When an option has no column mapped, or its mapped cells are empty for this SKU, the
 * option falls back to the overall context rather than generating with nothing. Silently
 * producing a callout free infographic would be worse than deriving points from the
 * general description.
 *
 * Em and en dashes are stripped at this boundary. The rule is stated in the prompt too,
 * but the model reliably echoes punctuation it is shown, so removing it from the input is
 * the more effective half of the enforcement.
 */
export function resolvePdpCopy(
  product: PdpProduct,
  option: PdpShotOption,
  session: PdpSheetSession | null,
  optionColumns: PdpOptionColumns
): PdpResolvedCopy {
  if (!session || !product.sheetRow) {
    return { overallContext: "", optionCopy: "", usedFallback: false };
  }

  const overallContext = stripDashes(joinCells(product.sheetRow, session.overallContextColumns));
  const mapped = optionColumns[option.id] ?? [];
  const direct = stripDashes(joinCells(product.sheetRow, mapped));

  if (direct) return { overallContext, optionCopy: direct, usedFallback: false };
  return { overallContext, optionCopy: overallContext, usedFallback: Boolean(overallContext) };
}

/**
 * Inverse view of the mapping: header to the roles it serves. Rendered on the sheet panel
 * so coverage can be checked without walking every option.
 */
export function buildColumnRoleView(
  session: PdpSheetSession | null,
  optionColumns: PdpOptionColumns,
  options: PdpShotOption[]
): { header: string; roles: string[] }[] {
  if (!session) return [];
  const labelById = new Map(options.map((o) => [o.id, o.label]));

  return session.headers
    .filter((h) => h !== session.skuColumn)
    .map((header) => {
      const roles: string[] = [];
      if (session.overallContextColumns.includes(header)) roles.push("Overall context");
      for (const [optionId, columns] of Object.entries(optionColumns)) {
        if (columns.includes(header)) roles.push(labelById.get(optionId) ?? optionId);
      }
      return { header, roles };
    });
}
