import type { ProductFolder, ProductReferenceFolder, ReferenceImageItem } from "@/lib/types";

/** Normalize a folder / product name for tolerant matching (case & separator insensitive). */
export function normalizeFolderName(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Raw grouping of image files by their immediate containing directory name. */
export interface ParsedReferenceGroup {
  name: string;
  files: File[];
}

/**
 * Parse a `webkitdirectory` FileList into per-subfolder image groups.
 *
 * Each file's `webkitRelativePath` looks like `parent/prod 1/img.jpg`; we key the
 * group on the file's IMMEDIATE containing directory (`parts[len-2]`), so a picked
 * parent containing product subfolders yields one group per product subfolder.
 * Non-image files are ignored. Loose files sitting directly in the picked root
 * (no subfolder) are skipped, since they cannot be attributed to a product.
 */
export function parseReferenceFolderFiles(fileList: FileList | File[]): ParsedReferenceGroup[] {
  const files = Array.from(fileList);
  const groups = new Map<string, File[]>();

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = relPath.split("/").filter(Boolean);
    // Need at least <folder>/<file>; the containing directory is the product name.
    if (parts.length < 2) continue;
    const folderName = parts[parts.length - 2];
    const existing = groups.get(folderName);
    if (existing) existing.push(file);
    else groups.set(folderName, [file]);
  }

  return Array.from(groups.entries()).map(([name, groupFiles]) => ({ name, files: groupFiles }));
}

/**
 * Build `ProductReferenceFolder[]` from parsed groups, auto-matching each group to
 * an input {@link ProductFolder} by normalized name. Unmatched groups get
 * `matchedFolderId: null` and surface in the reconciliation UI.
 *
 * Creates object-URL previews for every reference image; callers own revocation
 * (mirrors the store's existing add/remove discipline).
 */
export function buildReferenceFolders(
  groups: ParsedReferenceGroup[],
  primaryFolders: ProductFolder[]
): ProductReferenceFolder[] {
  const byName = new Map<string, ProductFolder>();
  for (const pf of primaryFolders) {
    byName.set(normalizeFolderName(pf.name), pf);
  }

  return groups.map((group) => {
    const match = byName.get(normalizeFolderName(group.name)) ?? null;
    const referenceImages: ReferenceImageItem[] = group.files.map((file) => ({
      id: uid("ref-img"),
      file,
      preview: URL.createObjectURL(file),
    }));
    return {
      id: uid("ref-folder"),
      name: group.name,
      matchedFolderId: match ? match.id : null,
      referenceImages,
      selectedBackgroundId: null,
    };
  });
}

/**
 * Convenience: parse a FileList and build matched `ProductReferenceFolder[]` in one call.
 */
export function importReferenceFolders(
  fileList: FileList | File[],
  primaryFolders: ProductFolder[]
): ProductReferenceFolder[] {
  return buildReferenceFolders(parseReferenceFolderFiles(fileList), primaryFolders);
}
