import type { EditImageAsset, EditImageSubfolder } from "./types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** A folder of image files grouped from a webkitdirectory upload. */
export interface GroupedFolder {
  name: string;
  files: File[];
}

/**
 * Groups files from a `webkitdirectory` upload by their immediate subfolder name.
 *
 * Mirrors the depth-detection logic duplicated across the VTON/infographic
 * `FolderUploadButton`s: when the selection contains nested subfolders
 * (`root/sub/img.jpg` → 3+ path segments) each immediate child of the root
 * becomes one group; a flat folder of images (`root/img.jpg`) becomes a single
 * group named after the root. Non-image files are ignored. Groups are sorted
 * case-insensitively by name.
 */
export function groupFilesByFolder(files: File[]): GroupedFolder[] {
  const imageFiles = files.filter((f) => f.type.startsWith("image/"));
  if (imageFiles.length === 0) return [];

  const hasSubFolders = imageFiles.some((file) => {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    return path.split("/").length > 2;
  });

  const folderMap = new Map<string, File[]>();
  for (const file of imageFiles) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = path.split("/");

    let folderName: string;
    if (hasSubFolders && parts.length > 2) {
      folderName = parts[1]; // immediate child folder of the root
    } else {
      folderName = parts.length > 1 ? parts[0] : "Untitled Folder";
    }

    if (!folderMap.has(folderName)) folderMap.set(folderName, []);
    folderMap.get(folderName)!.push(file);
  }

  return Array.from(folderMap.entries())
    .map(([name, groupedFiles]) => ({ name, files: groupedFiles }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Normalized key for matching subfolder names across the two parent folders. */
function correlationKey(name: string) {
  return name.trim().toLowerCase();
}

function toAssets(
  files: File[],
  prefix: string,
  reuse: Map<File, EditImageAsset>
): EditImageAsset[] {
  return files.map((file) => {
    const existing = reuse.get(file);
    if (existing) return existing;
    return { id: uid(prefix), file, preview: URL.createObjectURL(file) };
  });
}

/**
 * Correlates the AI-generation folders with the product-garment folders by shared
 * subfolder name (case-insensitive, trimmed). Produces one {@link EditImageSubfolder}
 * per distinct name across both sides. When a name exists on only one side the
 * subfolder is flagged via `unmatched` so the UI can warn and exclude it from
 * generation.
 *
 * `previous` lets callers preserve already-set `productOfInterest` selections and
 * stable ids when a user adds more folders to an existing pairing.
 */
export function correlateFolders(
  aiFolders: GroupedFolder[],
  productFolders: GroupedFolder[],
  previous: EditImageSubfolder[] = []
): EditImageSubfolder[] {
  const aiByKey = new Map(aiFolders.map((f) => [correlationKey(f.name), f]));
  const productByKey = new Map(productFolders.map((f) => [correlationKey(f.name), f]));
  const prevByKey = new Map(previous.map((s) => [correlationKey(s.name), s]));

  // Reuse existing assets (and their object-URL previews) for files that were
  // already uploaded, so re-correlating one side leaves the other side stable.
  const reuse = new Map<File, EditImageAsset>();
  for (const sub of previous) {
    for (const asset of [...sub.aiImages, ...sub.productImages]) {
      reuse.set(asset.file, asset);
    }
  }

  const keys = Array.from(new Set([...aiByKey.keys(), ...productByKey.keys()]));

  return keys
    .map((key) => {
      const ai = aiByKey.get(key);
      const product = productByKey.get(key);
      const prev = prevByKey.get(key);
      const name = ai?.name ?? product?.name ?? key;

      let unmatched: EditImageSubfolder["unmatched"];
      if (ai && !product) unmatched = "ai-only";
      else if (!ai && product) unmatched = "product-only";

      return {
        id: prev?.id ?? uid("editsub"),
        name,
        aiImages: ai ? toAssets(ai.files, "ai", reuse) : prev?.aiImages ?? [],
        productImages: product ? toAssets(product.files, "prod", reuse) : prev?.productImages ?? [],
        productOfInterest: prev?.productOfInterest,
        unmatched,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
