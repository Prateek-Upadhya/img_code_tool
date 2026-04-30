import Papa from "papaparse";
import type {
  BulkSpreadsheetMapping,
  BulkSpreadsheetNormalizedRow,
  BottomwearLength,
  FitType,
  ProductFolder,
  SleeveLength,
  TopwearLength,
} from "@/lib/types";
import { BULK_SPREADSHEET_FILTER_ALL } from "@/lib/types";

export function normalizeFitValue(raw: string): FitType | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const mapping: Record<string, FitType> = {
    slim: "slim",
    slimfit: "slim",
    regular: "regular",
    regularfit: "regular",
    relaxed: "relaxed",
    relaxedfit: "relaxed",
    oversized: "oversized",
    oversizedfit: "oversized",
    tailored: "tailored",
    tailoredfit: "tailored",
    loose: "loose",
    loosefit: "loose",
    bodycon: "bodycon",
    boxy: "boxy",
    boxyfit: "boxy",
  };
  return mapping[lower] ?? null;
}

export function normalizeSleeveLengthValue(raw: string): SleeveLength | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase().replace(/[\s_/]+/g, "");
  const mapping: Record<string, SleeveLength> = {
    full: "full",
    fullsleeve: "full",
    longsleeve: "full",
    long: "full",
    threequarter: "three-quarter",
    threequarters: "three-quarter",
    threequarterssleeve: "three-quarter",
    "34": "three-quarter",
    "34sleeve": "three-quarter",
    half: "half",
    shortsleeve: "half",
    halfsleeve: "half",
    short: "half",
    sleeveless: "sleeveless",
    nosleeve: "sleeveless",
  };
  return mapping[lower] ?? null;
}

export function normalizeTopwearLengthValue(raw: string): TopwearLength | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase().replace(/[\s_/]+/g, "");
  const mapping: Record<string, TopwearLength> = {
    full: "full",
    shin: "full",
    tunic: "full",
    maxi: "full",
    fulllengthtop: "full",
    threequarter: "three-quarter",
    knee: "three-quarter",
    kneelength: "three-quarter",
    "34": "three-quarter",
    midthigh: "mid-thigh",
    midhigh: "mid-thigh",
    longline: "mid-thigh",
    thigh: "mid-thigh",
    half: "half",
    waist: "half",
    waistlength: "half",
    croppedtop: "half",
  };
  return mapping[lower] ?? null;
}

export function normalizeBottomwearLengthValue(raw: string): BottomwearLength | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase().replace(/[\s_/]+/g, "");
  const mapping: Record<string, BottomwearLength> = {
    full: "full",
    ankle: "full",
    fulllength: "full",
    pants: "full",
    threequarter: "three-quarter",
    capri: "three-quarter",
    cropped: "three-quarter",
    "34": "three-quarter",
    shorts: "shorts",
    short: "shorts",
    shortpants: "shorts",
  };
  return mapping[lower] ?? null;
}

/** Trimmed display value for filter column; empty cell becomes "(empty)" */
export function normalizeSpreadsheetFilterValue(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  return t === "" ? "(empty)" : t;
}

/** Strip BOM/whitespace and Excel-style wrapping quotes from a pasted URL. */
export function normalizeImportedImageUrl(raw: string): string {
  let s = (raw ?? "").trim().replace(/^\uFEFF/, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith("\u201c") && s.endsWith("\u201d"))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (!s) return s;
  try {
    const u = new URL(s);
    return u.href;
  } catch {
    return s;
  }
}

/** True if string looks like a complete image URL (handles commas in path/query). */
function isProbablyCompleteImageUrl(s: string): boolean {
  const t = s.trim();
  return /\.(jpe?g|png|gif|webp|bmp|svg)(?:\?|#|$)/i.test(t);
}

/**
 * CSV rows often split on commas inside URLs like `.../width=1080,height=1440,...`.
 * Re-merge overflow cells until column count matches headers.
 */
function rebalanceOverflowCsvRow(row: string[], headerCount: number): string[] {
  if (row.length >= headerCount) {
    const out = [...row];
    while (out.length > headerCount) {
      let merged = false;
      for (let i = 0; i < out.length - 1; i++) {
        const a = out[i];
        if (!/^https?:\/\//i.test(a)) continue;
        if (isProbablyCompleteImageUrl(a)) continue;
        out[i] = `${a},${out[i + 1]}`;
        out.splice(i + 1, 1);
        merged = true;
        break;
      }
      if (!merged) {
        out[headerCount - 1] = out.slice(headerCount - 1).join(",");
        out.length = headerCount;
        break;
      }
    }
    return out.slice(0, headerCount);
  }
  return [...row, ...Array(headerCount - row.length).fill("")].slice(0, headerCount);
}

function extractHyperlinkFromFormula(f: string): string | null {
  const s = f.trim().replace(/^=/, "");
  const dbl = s.match(/^HYPERLINK\s*\(\s*"([^"]+)"/i);
  if (dbl?.[1]) return dbl[1];
  const sgl = s.match(/^HYPERLINK\s*\(\s*'([^']+)'/i);
  if (sgl?.[1]) return sgl[1];
  return null;
}

function xlsxCellToString(
  ws: import("xlsx").WorkSheet,
  R: number,
  C: number,
  XLSX: typeof import("xlsx")
): string {
  const addr = XLSX.utils.encode_cell({ r: R, c: C });
  const cell = ws[addr] as
    | (import("xlsx").CellObject & {
        l?: { Target?: string; target?: string };
      })
    | undefined;
  if (!cell) return "";

  const link = cell.l;
  if (link && typeof link === "object") {
    const t = (link.Target || link.target || "").trim();
    if (t) {
      if (/^https?:\/\//i.test(t)) return t;
      if (t.startsWith("//")) return `https:${t}`;
    }
  }

  if (typeof cell.f === "string" && cell.f.includes("HYPERLINK")) {
    const fromF = extractHyperlinkFromFormula(cell.f);
    if (fromF?.trim()) return fromF.trim();
  }

  try {
    const formatted = XLSX.utils.format_cell(cell);
    if (formatted != null && String(formatted).trim()) return String(formatted).trim();
  } catch {
    /* empty */
  }
  if (cell.v != null && cell.v !== "") return String(cell.v).trim();
  return "";
}

function guessMimeFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const dot = path.lastIndexOf(".");
    if (dot === -1) return null;
    const ext = path.slice(dot);
    const map: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".svg": "image/svg+xml",
    };
    return map[ext] ?? null;
  } catch {
    return null;
  }
}

/** Detect image format from magic bytes when Content-Type is wrong or empty (common on CDNs). */
function sniffImageMimeType(buf: ArrayBuffer): string | null {
  const u8 = new Uint8Array(buf.byteLength ? buf.slice(0, 512) : buf);
  if (u8.length < 3) return null;
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "image/jpeg";
  if (u8.length >= 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return "image/png";
  if (u8.length >= 6 && u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return "image/gif";
  if (u8.length >= 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) {
    const tag = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
    if (tag === "WEBP") return "image/webp";
  }
  const head = new TextDecoder("utf-8", { fatal: false }).decode(
    u8.slice(0, Math.min(256, u8.length))
  );
  const t = head.trimStart();
  if (t.startsWith("<svg") || t.startsWith("<?xml")) return "image/svg+xml";
  return null;
}

function withImageExtension(name: string, ext: string): string {
  const e = ext.replace(/^\.+/, "").replace(/[^a-z0-9]/gi, "") || "jpg";
  const lower = name.toLowerCase();
  if (lower.endsWith(`.${e}`)) return name;
  return `${name}.${e}`;
}

async function blobToImageFile(blob: Blob, sourceUrl: string, filename: string): Promise<File | null> {
  const headerType = (blob.type || "").toLowerCase();

  if (headerType.startsWith("image/")) {
    const ext = headerType.split("/")[1]?.split(";")[0]?.trim() || "jpg";
    return new File([blob], withImageExtension(filename, ext), { type: headerType });
  }

  const buf = await blob.arrayBuffer();
  let mime = sniffImageMimeType(buf) ?? guessMimeFromUrl(sourceUrl);
  if (!mime?.startsWith("image/")) return null;
  const ext = mime.split("/")[1] || "jpg";
  return new File([buf], withImageExtension(filename, ext), { type: mime });
}

/**
 * Loads a remote image as File: tries browser CORS fetch first, then same-origin server proxy (for CDNs without CORS).
 */
export async function fetchImageAsFile(url: string, filename: string): Promise<File | null> {
  try {
    const direct = await fetch(url, { mode: "cors" });
    if (direct.ok) {
      const blob = await direct.blob();
      const file = await blobToImageFile(blob, url, filename);
      if (file) return file;
    }
  } catch {
    /* CORS or network — fall through to proxy */
  }

  try {
    const proxied = await fetch("/api/bulk-image-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!proxied.ok) return null;
    const blob = await proxied.blob();
    return await blobToImageFile(blob, url, filename);
  } catch {
    return null;
  }
}

function dedupeHeaders(rawHeaders: string[]): { headers: string[]; error?: string } {
  const seen = new Map<string, number>();
  const headers: string[] = [];
  for (let i = 0; i < rawHeaders.length; i++) {
    let h = rawHeaders[i]?.trim() ?? "";
    if (!h) {
      h = `Column ${i + 1}`;
    }
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    headers.push(count === 0 ? h : `${h} (${count + 1})`);
  }
  return { headers };
}

export interface ParsedSpreadsheet {
  headers: string[];
  records: Record<string, string>[];
  errors: string[];
}

function recordsFromRows(headerRow: string[], bodyRows: string[][]): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  for (const row of bodyRows) {
    if (row.every((c) => String(c ?? "").trim() === "")) continue;
    const rec: Record<string, string> = {};
    for (let i = 0; i < headerRow.length; i++) {
      const key = headerRow[i];
      if (!key) continue;
      rec[key] = String(row[i] ?? "").trim();
    }
    records.push(rec);
  }
  return records;
}

async function parseXlsx(file: File): Promise<ParsedSpreadsheet> {
  const errors: string[] = [];
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellNF: false, cellStyles: false });
  const firstName = wb.SheetNames[0];
  if (!firstName) {
    return { headers: [], records: [], errors: ["Workbook has no sheets"] };
  }
  const ws = wb.Sheets[firstName];
  const ref = ws["!ref"];
  if (!ref) {
    return { headers: [], records: [], errors: ["First sheet has no range"] };
  }
  const range = XLSX.utils.decode_range(ref);
  const matrix: string[][] = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: string[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      row.push(xlsxCellToString(ws, R, C, XLSX));
    }
    matrix.push(row);
  }
  if (!matrix.length) {
    return { headers: [], records: [], errors: ["First sheet is empty"] };
  }
  const rawHeader = matrix[0].map((c) => String(c ?? ""));
  const { headers, error } = dedupeHeaders(rawHeader);
  if (error) errors.push(error);
  if (headers.length === 0) {
    return { headers: [], records: [], errors };
  }
  const body = matrix.slice(1).map((row) => {
    const cells = row.map((c) => String(c ?? "").trim());
    const balanced = rebalanceOverflowCsvRow(cells, headers.length);
    const out: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      out.push(String(balanced[i] ?? "").trim());
    }
    return out;
  });
  const records = recordsFromRows(headers, body);
  return { headers, records, errors };
}

function parseDelimitedText(text: string, delimiter: string): ParsedSpreadsheet {
  const errors: string[] = [];
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter,
  });
  if (result.errors.length > 0) {
    errors.push(...result.errors.map((e) => `Row ${e.row}: ${e.message}`));
  }
  const matrix = result.data.filter((row) => row.some((c) => String(c ?? "").trim() !== ""));
  if (matrix.length === 0) {
    return { headers: [], records: [], errors: [...errors, "No data rows found"] };
  }
  const rawHeader = matrix[0].map((c) => String(c ?? "").trim());
  const { headers, error } = dedupeHeaders(rawHeader);
  if (error) errors.push(error);
  const dataRows = matrix.slice(1);
  const hadCsvOverflow = dataRows.some((row) => row.length > headers.length);
  if (hadCsvOverflow) {
    errors.push(
      "Some CSV rows had more fields than columns (often commas inside unquoted URLs). Extra fields were merged into URL cells where possible; quoting those URLs or using .xlsx is most reliable."
    );
  }
  const body = dataRows.map((row) => {
    const cells = row.map((c) => String(c ?? "").trim());
    const balanced = rebalanceOverflowCsvRow(cells, headers.length);
    const out: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      out.push(String(balanced[i] ?? "").trim());
    }
    return out;
  });
  const records = recordsFromRows(headers, body);
  return { headers, records, errors };
}

function guessDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  if (tabs > commas) return "\t";
  return ",";
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsx(file);
  }
  const text = await file.text();
  const delimiter = guessDelimiter(text);
  return parseDelimitedText(text, delimiter);
}

export interface BuildRowsResult {
  rows: BulkSpreadsheetNormalizedRow[];
  errors: string[];
}

export function validateMapping(mapping: BulkSpreadsheetMapping, headers: string[]): string | null {
  const valid = new Set(headers);
  if (!mapping.productNameColumn || !valid.has(mapping.productNameColumn)) {
    return "Select a valid product name column.";
  }
  if (!mapping.imageUrlColumns.length) {
    return "Select at least one image URL column.";
  }
  for (const c of mapping.imageUrlColumns) {
    if (!valid.has(c)) return `Invalid image column: ${c}`;
  }
  const imgSet = new Set(mapping.imageUrlColumns);
  if (imgSet.has(mapping.productNameColumn)) {
    return "Product name column must not be one of the image URL columns.";
  }
  const optionalCols = [
    mapping.fitColumn,
    mapping.sleeveLengthColumn,
    mapping.topwearLengthColumn,
    mapping.bottomwearLengthColumn,
    mapping.filterColumn,
  ].filter((c): c is string => c != null && c !== "");

  const colSet = new Set(optionalCols);
  if (colSet.size !== optionalCols.length) {
    return "Fit, sleeve length, top hemline, bottomwear length, and filter columns must all be different when set.";
  }

  if (mapping.fitColumn) {
    if (!valid.has(mapping.fitColumn)) return "Invalid fit column.";
    if (mapping.fitColumn === mapping.productNameColumn || imgSet.has(mapping.fitColumn)) {
      return "Fit column must be different from product name and image columns.";
    }
  }
  if (mapping.sleeveLengthColumn) {
    if (!valid.has(mapping.sleeveLengthColumn)) return "Invalid sleeve length column.";
    if (
      mapping.sleeveLengthColumn === mapping.productNameColumn ||
      imgSet.has(mapping.sleeveLengthColumn)
    ) {
      return "Sleeve length column must be different from product name and image columns.";
    }
  }
  if (mapping.topwearLengthColumn) {
    if (!valid.has(mapping.topwearLengthColumn)) return "Invalid top hemline column.";
    if (
      mapping.topwearLengthColumn === mapping.productNameColumn ||
      imgSet.has(mapping.topwearLengthColumn)
    ) {
      return "Top hemline column must be different from product name and image columns.";
    }
  }
  if (mapping.bottomwearLengthColumn) {
    if (!valid.has(mapping.bottomwearLengthColumn)) return "Invalid bottomwear length column.";
    if (
      mapping.bottomwearLengthColumn === mapping.productNameColumn ||
      imgSet.has(mapping.bottomwearLengthColumn)
    ) {
      return "Bottomwear length column must be different from product name and image columns.";
    }
  }
  if (mapping.filterColumn) {
    if (!valid.has(mapping.filterColumn)) return "Invalid filter column.";
    if (mapping.filterColumn === mapping.productNameColumn || imgSet.has(mapping.filterColumn)) {
      return "Filter column must be different from product name and image columns.";
    }
  }
  return null;
}

export function buildNormalizedRows(
  records: Record<string, string>[],
  mapping: BulkSpreadsheetMapping
): BuildRowsResult {
  const errors: string[] = [];
  const rows: BulkSpreadsheetNormalizedRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const productName = (record[mapping.productNameColumn] || "").trim();
    if (!productName) {
      errors.push(`Row ${i + 2}: Missing product name`);
      continue;
    }

    const fitRaw = mapping.fitColumn ? record[mapping.fitColumn] || "" : "";
    const fit = mapping.fitColumn ? normalizeFitValue(fitRaw) : null;

    const sleeveRaw = mapping.sleeveLengthColumn ? record[mapping.sleeveLengthColumn] || "" : "";
    const sleeveLength = mapping.sleeveLengthColumn ? normalizeSleeveLengthValue(sleeveRaw) : null;

    const topRaw = mapping.topwearLengthColumn ? record[mapping.topwearLengthColumn] || "" : "";
    const topwearLength = mapping.topwearLengthColumn ? normalizeTopwearLengthValue(topRaw) : null;

    const bottomRaw = mapping.bottomwearLengthColumn ? record[mapping.bottomwearLengthColumn] || "" : "";
    const bottomwearLength = mapping.bottomwearLengthColumn
      ? normalizeBottomwearLengthValue(bottomRaw)
      : null;

    const imageUrls: string[] = [];
    for (const col of mapping.imageUrlColumns) {
      const url = normalizeImportedImageUrl(record[col] || "");
      if (url) imageUrls.push(url);
    }

    if (imageUrls.length === 0) {
      errors.push(`Row ${i + 2}: No image URLs for "${productName}"`);
      continue;
    }

    const filterValue = mapping.filterColumn
      ? normalizeSpreadsheetFilterValue(record[mapping.filterColumn])
      : null;

    rows.push({
      productName,
      imageUrls,
      fit,
      sleeveLength,
      topwearLength,
      bottomwearLength,
      filterValue,
    });
  }

  return { rows, errors };
}

export function uniqueFilterValues(rows: BulkSpreadsheetNormalizedRow[]): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    if (r.filterValue != null) s.add(r.filterValue);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

/** Unique filter labels from raw sheet rows (before product/url validation), matching normalized import semantics */
export function uniqueFilterValuesFromRecords(
  records: Record<string, string>[],
  filterColumn: string
): string[] {
  const s = new Set<string>();
  for (const rec of records) {
    s.add(normalizeSpreadsheetFilterValue(rec[filterColumn]));
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function groupRowsForImport(
  rows: BulkSpreadsheetNormalizedRow[],
  filter: string
): Map<
  string,
  {
    fit: FitType | null;
    sleeveLength: SleeveLength | null;
    topwearLength: TopwearLength | null;
    bottomwearLength: BottomwearLength | null;
    urls: string[];
  }
> {
  const filtered =
    filter === BULK_SPREADSHEET_FILTER_ALL
      ? rows
      : rows.filter((r) => r.filterValue === filter);

  const styleMap = new Map<
    string,
    {
      fit: FitType | null;
      sleeveLength: SleeveLength | null;
      topwearLength: TopwearLength | null;
      bottomwearLength: BottomwearLength | null;
      urls: string[];
    }
  >();
  for (const row of filtered) {
    const existing = styleMap.get(row.productName);
    if (existing) {
      existing.urls.push(...row.imageUrls);
      if (row.fit && !existing.fit) existing.fit = row.fit;
      if (row.sleeveLength && !existing.sleeveLength) existing.sleeveLength = row.sleeveLength;
      if (row.topwearLength && !existing.topwearLength) existing.topwearLength = row.topwearLength;
      if (row.bottomwearLength && !existing.bottomwearLength)
        existing.bottomwearLength = row.bottomwearLength;
    } else {
      styleMap.set(row.productName, {
        fit: row.fit,
        sleeveLength: row.sleeveLength,
        topwearLength: row.topwearLength,
        bottomwearLength: row.bottomwearLength,
        urls: [...row.imageUrls],
      });
    }
  }
  return styleMap;
}

export async function downloadSpreadsheetProductFolders(
  normalizedRows: BulkSpreadsheetNormalizedRow[],
  filter: string,
  sessionId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ folders: ProductFolder[]; errors: string[] }> {
  const errors: string[] = [];
  const styleMap = groupRowsForImport(normalizedRows, filter);

  const totalUrls = Array.from(styleMap.values()).reduce((sum, v) => sum + v.urls.length, 0);
  let downloadedCount = 0;
  const folders: ProductFolder[] = [];

  for (const [productName, { fit, sleeveLength, topwearLength, bottomwearLength, urls }] of styleMap) {
    const images: ProductFolder["images"] = [];

    const batchSize = 4;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((url, batchIdx) =>
          fetchImageAsFile(url, `${productName}_${i + batchIdx + 1}`)
        )
      );
      for (const fileResult of results) {
        downloadedCount++;
        onProgress?.(downloadedCount, totalUrls);
        if (fileResult) {
          images.push({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file: fileResult,
            preview: URL.createObjectURL(fileResult),
          });
        }
      }
    }

    if (images.length > 0) {
      folders.push({
        id: `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: productName,
        images,
        fit,
        sleeveLength,
        topwearLength,
        bottomwearLength,
        bulkImportSessionId: sessionId,
      });
    } else {
      errors.push(`"${productName}": All image downloads failed`);
    }
  }

  return { folders, errors };
}
