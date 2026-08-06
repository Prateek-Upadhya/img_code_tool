import type {
  InfographicProductFolder,
  InfographicSheetMapping,
  InfographicSheetSession,
} from "@/lib/types";

/**
 * Callout-spreadsheet import for the bulk infographic wizard.
 *
 * Parsing itself is reused from `bulk-spreadsheet-import.ts` (`parseSpreadsheetFile` handles
 * xlsx/xls via SheetJS and csv/tsv via PapaParse). This module only covers what is specific to
 * infographic callouts: matching sheet rows to product cards by SKU and turning mapped columns
 * into `minimalisticInfo` / `soleConstructionInfo` patches.
 */

/** Sentinel for "no column mapped" — Radix `Select` forbids empty-string item values. */
export const SHEET_MAP_NONE = "__none__";

/** One sheet row reduced to the three fields this feature cares about. */
export interface InfographicSheetRow {
  /** SKU exactly as it appears in the sheet, for the unmatched report. */
  sku: string;
  minimalistic: string;
  soleConstruction: string;
}

export type InfographicSheetIndex = Map<string, InfographicSheetRow>;

export interface InfographicFolderPatch {
  id: string;
  patch: Partial<InfographicProductFolder>;
}

export interface ApplySheetResult {
  /** Patches to hand to `store.patchInfographicFolders`. */
  patches: InfographicFolderPatch[];
  /** Pre-import values for the same folders, for one-click undo. */
  snapshot: InfographicFolderPatch[];
  /** Number of products that had at least one field written. */
  filledCount: number;
  /** Sheet SKUs that matched no product. */
  unmatchedSkus: string[];
  /** Product names that got no value from the sheet. */
  unfilledProducts: string[];
}

const TRAILING_FILE_EXTENSION = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|avif)$/i;
/** Zero-width spaces / joiners and the BOM — invisible junk that survives Excel round-trips. */
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

/**
 * Collapse a SKU or product name to a comparison key: `STYLE-001`, `style_001 ` and
 * `Style 001.jpg` all become `style001`. Product names come from uploaded folder names, so a
 * trailing image extension is stripped for the flat-folder case.
 */
export function normalizeSkuKey(raw: string): string {
  return (raw ?? "")
    .replace(ZERO_WIDTH, "")
    .trim()
    .replace(TRAILING_FILE_EXTENSION, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Verbatim-preserving cleanup for a callout cell: drop BOM / zero-width characters, normalise
 * CRLF to LF, trim the outer whitespace. Nothing else.
 *
 * Deliberately does NOT strip wrapping quotes the way `normalizeImportedImageUrl` does — both
 * callout fields treat quoted text as "render this exact wording", so a fully-quoted cell is
 * meaningful content rather than an Excel artefact. CSV-level quoting is already unwrapped by
 * PapaParse, and xlsx cell values never carry it.
 */
export function cleanCalloutCell(raw: string): string {
  return (raw ?? "").replace(ZERO_WIDTH, "").replace(/\r\n?/g, "\n").trim();
}

function findHeader(headers: string[], patterns: RegExp[], used: Set<string>): string | null {
  for (const re of patterns) {
    const hit = headers.find((h) => !used.has(h) && re.test(h));
    if (hit) return hit;
  }
  return null;
}

/**
 * Best-effort mapping from header names, so the usual sheet needs one click to confirm.
 * Sole-construction is guessed before minimalistic: its patterns are the specific ones, which
 * keeps a lone `sole_callouts` column from being claimed by minimalistic's generic /callout/.
 */
export function guessInfographicMapping(headers: string[]): InfographicSheetMapping {
  const used = new Set<string>();

  const skuColumn =
    findHeader(
      headers,
      [/\bsku\b/i, /style.?(code|no|number|id)/i, /article/i, /product.?(code|id)/i, /\bcode\b/i, /product.?name/i],
      used
    ) ??
    headers[0] ??
    "";
  if (skuColumn) used.add(skuColumn);

  const soleConstructionColumn = findHeader(headers, [/sole/i, /construction/i, /exploded/i, /layer/i], used);
  if (soleConstructionColumn) used.add(soleConstructionColumn);

  const minimalisticColumn = findHeader(headers, [/minimal/i, /callout/i, /feature/i, /\busp\b/i, /highlight/i], used);

  return { skuColumn, minimalisticColumn, soleConstructionColumn };
}

/** Returns an error message for an unusable mapping, or null when it is good to import. */
export function validateInfographicMapping(
  mapping: InfographicSheetMapping,
  headers: string[]
): string | null {
  const valid = new Set(headers);

  if (!mapping.skuColumn || !valid.has(mapping.skuColumn)) {
    return "Select the column that holds the product SKU.";
  }
  if (!mapping.minimalisticColumn && !mapping.soleConstructionColumn) {
    return "Map at least one callout column — minimalistic or sole-construction.";
  }
  if (mapping.minimalisticColumn && !valid.has(mapping.minimalisticColumn)) {
    return "The minimalistic callouts column is not in this sheet.";
  }
  if (mapping.soleConstructionColumn && !valid.has(mapping.soleConstructionColumn)) {
    return "The sole-construction column is not in this sheet.";
  }

  const chosen = [mapping.skuColumn, mapping.minimalisticColumn, mapping.soleConstructionColumn].filter(
    (c): c is string => Boolean(c)
  );
  if (new Set(chosen).size !== chosen.length) {
    return "Each column can only be mapped once.";
  }
  return null;
}

/**
 * Index the parsed records by normalized SKU. Rows with a blank SKU are dropped; on duplicate
 * SKUs the first row wins.
 */
export function buildSheetIndex(
  records: Record<string, string>[],
  mapping: InfographicSheetMapping
): InfographicSheetIndex {
  const index: InfographicSheetIndex = new Map();

  for (const record of records) {
    const sku = (record[mapping.skuColumn] ?? "").trim();
    const key = normalizeSkuKey(sku);
    if (!key || index.has(key)) continue;

    index.set(key, {
      sku,
      minimalistic: mapping.minimalisticColumn ? cleanCalloutCell(record[mapping.minimalisticColumn] ?? "") : "",
      soleConstruction: mapping.soleConstructionColumn
        ? cleanCalloutCell(record[mapping.soleConstructionColumn] ?? "")
        : "",
    });
  }
  return index;
}

/**
 * Match every product against the sheet and build the patches to apply.
 *
 * A field is written only when its column is mapped AND the cell is non-empty, so a blank cell
 * never wipes text that is already there.
 */
export function applySheetToFolders(
  folders: InfographicProductFolder[],
  index: InfographicSheetIndex
): ApplySheetResult {
  const patches: InfographicFolderPatch[] = [];
  const snapshot: InfographicFolderPatch[] = [];
  const matchedKeys = new Set<string>();
  const unfilledProducts: string[] = [];

  for (const folder of folders) {
    const key = normalizeSkuKey(folder.name);
    const row = key ? index.get(key) : undefined;
    if (!row) {
      unfilledProducts.push(folder.name);
      continue;
    }
    matchedKeys.add(key);

    const patch: Partial<InfographicProductFolder> = {};
    const sheetFilled = { ...folder.sheetFilled };
    const prior: Partial<InfographicProductFolder> = { sheetFilled: folder.sheetFilled };

    if (row.minimalistic) {
      prior.minimalisticInfo = folder.minimalisticInfo;
      patch.minimalisticInfo = row.minimalistic;
      sheetFilled.minimalisticInfo = true;
    }
    if (row.soleConstruction) {
      prior.soleConstructionInfo = folder.soleConstructionInfo;
      patch.soleConstructionInfo = row.soleConstruction;
      sheetFilled.soleConstructionInfo = true;
    }

    // Matched, but every mapped cell for this SKU was blank.
    if (Object.keys(patch).length === 0) {
      unfilledProducts.push(folder.name);
      continue;
    }

    snapshot.push({ id: folder.id, patch: prior });
    patches.push({ id: folder.id, patch: { ...patch, sheetFilled } });
  }

  const unmatchedSkus: string[] = [];
  for (const [key, row] of index) {
    if (!matchedKeys.has(key)) unmatchedSkus.push(row.sku);
  }

  return { patches, snapshot, filledCount: patches.length, unmatchedSkus, unfilledProducts };
}

/** How many products the given index would fill — drives the dialog's confirm-button label. */
export function countSheetMatches(
  folders: InfographicProductFolder[],
  index: InfographicSheetIndex
): number {
  return applySheetToFolders(folders, index).filledCount;
}

/**
 * Callout fields for a product that is being created while a sheet is attached, so folder
 * uploads made after an import fill themselves. Returns `{}` when nothing matches.
 */
export function seedFolderFromSheet(
  name: string,
  index: InfographicSheetIndex | null
): Partial<InfographicProductFolder> {
  if (!index) return {};
  const row = index.get(normalizeSkuKey(name));
  if (!row) return {};

  const seed: Partial<InfographicProductFolder> = {};
  const sheetFilled: NonNullable<InfographicProductFolder["sheetFilled"]> = {};

  if (row.minimalistic) {
    seed.minimalisticInfo = row.minimalistic;
    sheetFilled.minimalisticInfo = true;
  }
  if (row.soleConstruction) {
    seed.soleConstructionInfo = row.soleConstruction;
    sheetFilled.soleConstructionInfo = true;
  }
  if (Object.keys(seed).length === 0) return {};

  seed.sheetFilled = sheetFilled;
  return seed;
}

/**
 * Fields to apply when a product is renamed while a sheet is attached. This is the documented
 * fix for a product the summary bar reported as "not found in the sheet": rename it to its SKU
 * and the callouts arrive.
 *
 * Unlike the import itself, this only fills fields that are still empty — a rename must never
 * clobber text the user typed. Returns null when there is nothing to do.
 */
export function refillFolderOnRename(
  folder: InfographicProductFolder,
  name: string,
  index: InfographicSheetIndex | null
): Partial<InfographicProductFolder> | null {
  if (!index) return null;
  const row = index.get(normalizeSkuKey(name));
  if (!row) return null;

  const patch: Partial<InfographicProductFolder> = {};
  const sheetFilled = { ...folder.sheetFilled };

  if (row.minimalistic && !folder.minimalisticInfo?.trim()) {
    patch.minimalisticInfo = row.minimalistic;
    sheetFilled.minimalisticInfo = true;
  }
  if (row.soleConstruction && !folder.soleConstructionInfo?.trim()) {
    patch.soleConstructionInfo = row.soleConstruction;
    sheetFilled.soleConstructionInfo = true;
  }
  if (Object.keys(patch).length === 0) return null;

  patch.sheetFilled = sheetFilled;
  return patch;
}

/** Convenience: build the lookup index straight from an attached session. */
export function sheetIndexFromSession(session: InfographicSheetSession | null): InfographicSheetIndex | null {
  if (!session) return null;
  return buildSheetIndex(session.records, session.mapping);
}
