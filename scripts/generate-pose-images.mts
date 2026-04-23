/**
 * One-time script to generate AI pose thumbnail images for clothing poses.
 * Uses Nano Banana Pro (gemini-3-pro-image-preview) to create consistent
 * pose reference thumbnails stored in public/poses/.
 *
 * Usage:
 *   npx tsx scripts/generate-pose-images.mts <GEMINI_API_KEY>
 *
 * Options:
 *   --force    Regenerate all images even if they already exist
 *   --dry-run  Print poses that would be generated without calling API
 *   --id=X     Generate only pose with id X (comma-separated for multiple)
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

interface Pose {
  id: string;
  name: string;
  description: string;
  viewAngle: string;
  framing: string;
  requiresModel?: boolean;
}

const POSES: Pose[] = [
  { id: "front-standing-full", name: "Front Standing", description: "Standing facing camera, relaxed posture, complete model visible head to toe", viewAngle: "front", framing: "full-body" },
  { id: "front-hand-on-hip-full", name: "Hand on Hip", description: "Confident front pose with hand on hip, full body from head to toe", viewAngle: "front", framing: "full-body" },
  { id: "front-crossed-arms-full", name: "Crossed Arms", description: "Arms crossed, confident editorial pose, full body head to toe", viewAngle: "front", framing: "full-body" },
  { id: "front-walking-full", name: "Walking (Front)", description: "Walking towards camera with natural stride, full body visible", viewAngle: "front", framing: "full-body" },
  { id: "front-contrapposto-full", name: "Contrapposto", description: "Weight on one leg, slight hip tilt, elegant full body front view", viewAngle: "front", framing: "full-body" },
  { id: "front-hands-in-pockets-full", name: "Hands in Pockets", description: "Casual stance with hands in pockets, full body head to toe", viewAngle: "front", framing: "full-body" },
  { id: "front-standing-3q", name: "Front Standing", description: "Standing facing camera, framed from head to below knee", viewAngle: "front", framing: "three-quarter" },
  { id: "front-hand-on-hip-3q", name: "Hand on Hip", description: "Hand on hip pose, framed from head to below knee", viewAngle: "front", framing: "three-quarter" },
  { id: "front-walking-3q", name: "Walking (Front)", description: "Walking towards camera, framed from head to below knee", viewAngle: "front", framing: "three-quarter" },
  { id: "front-standing-mid", name: "Front Standing", description: "Standing facing camera, framed from head to mid-thigh", viewAngle: "front", framing: "mid-thigh" },
  { id: "front-hand-on-hip-mid", name: "Hand on Hip", description: "Confident hand on hip, framed from head to mid-thigh", viewAngle: "front", framing: "mid-thigh" },
  { id: "front-crossed-arms-mid", name: "Crossed Arms", description: "Arms crossed, editorial pose, framed from head to mid-thigh", viewAngle: "front", framing: "mid-thigh" },
  { id: "front-standing-waist", name: "Front Standing", description: "Standing facing camera, cropped at waist showing upper body", viewAngle: "front", framing: "waist-up" },
  { id: "front-hand-on-hip-waist", name: "Hand on Hip", description: "Hand on hip, waist-up crop focusing on upper body silhouette", viewAngle: "front", framing: "waist-up" },
  { id: "front-crossed-arms-waist", name: "Crossed Arms", description: "Arms crossed, waist-up crop highlighting neckline and sleeves", viewAngle: "front", framing: "waist-up" },
  { id: "front-casual-waist", name: "Casual Pose", description: "Relaxed casual upper body pose, waist-up framing", viewAngle: "front", framing: "waist-up" },
  { id: "front-closeup-bust", name: "Front Close-Up", description: "Close-up from chest upward showing neckline, collar, and fabric texture detail", viewAngle: "front", framing: "bust-up" },
  { id: "front-neckline-bust", name: "Neckline Detail", description: "Detail close-up focusing on neckline shape, collar construction, and upper garment", viewAngle: "front", framing: "bust-up" },
  { id: "front-standing-hip-down", name: "Front Standing", description: "Lower body focus from hip to feet, front view showing waistband, pockets, and full leg", viewAngle: "front", framing: "hip-down" },
  { id: "front-walking-hip-down", name: "Walking (Front)", description: "Walking stride from hip to feet, showing drape, movement, and leg silhouette", viewAngle: "front", framing: "hip-down" },
  { id: "front-pockets-hip-down", name: "Hands in Pockets", description: "Hands in pockets, hip to feet view showing pocket depth, fit through hip and thigh", viewAngle: "front", framing: "hip-down" },
  { id: "front-wide-stance-hip-down", name: "Wide Stance", description: "Feet apart, hip to feet view showing inner leg seams, fit, and full garment width", viewAngle: "front", framing: "hip-down" },
  { id: "front-standing-knee-down", name: "Front Knee-Down", description: "Knee to feet detail showing hemline, ankle fit, break, and footwear pairing", viewAngle: "front", framing: "knee-down" },
  { id: "tqf-standing-full", name: "¾ Front Standing", description: "Angled front view showing front and side of garment, full body head to toe", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-walking-full", name: "¾ Front Walking", description: "Walking at an angle towards camera, full body visible showing garment in motion", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-seated-full", name: "¾ Front Seated", description: "Seated at angle showing how garment drapes when sitting, full body visible", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-leaning-full", name: "¾ Front Leaning", description: "Leaning casually against a surface at an angle, full body visible", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-standing-3q", name: "¾ Front Standing", description: "Angled front view, framed from head to below knee", viewAngle: "three-quarter-front", framing: "three-quarter" },
  { id: "tqf-walking-3q", name: "¾ Front Walking", description: "Walking at angle, framed from head to below knee", viewAngle: "three-quarter-front", framing: "three-quarter" },
  { id: "tqf-standing-waist", name: "¾ Front Standing", description: "Angled front view, waist-up crop showing upper body and partial side", viewAngle: "three-quarter-front", framing: "waist-up" },
  { id: "tqf-seated-waist", name: "¾ Front Seated", description: "Seated at angle, waist-up crop showing how top drapes while seated", viewAngle: "three-quarter-front", framing: "waist-up" },
  { id: "tqf-standing-hip-down", name: "¾ Front Standing", description: "Angled front view, hip to feet showing lower garment with dimensional depth", viewAngle: "three-quarter-front", framing: "hip-down" },
  { id: "side-profile-full", name: "Side Profile", description: "Full side profile showing complete garment silhouette and drape, head to toe", viewAngle: "side", framing: "full-body" },
  { id: "side-walking-full", name: "Walking (Side)", description: "Mid-stride side view showing movement, flow, and full silhouette", viewAngle: "side", framing: "full-body" },
  { id: "side-leaning-full", name: "Leaning (Side)", description: "Leaning against surface in profile, showing how garment drapes with gravity", viewAngle: "side", framing: "full-body" },
  { id: "side-profile-3q", name: "Side Profile", description: "Side profile from head to below knee, showing upper and mid-body silhouette", viewAngle: "side", framing: "three-quarter" },
  { id: "side-walking-3q", name: "Walking (Side)", description: "Side walking stride, head to below knee, showing movement in profile", viewAngle: "side", framing: "three-quarter" },
  { id: "side-profile-waist", name: "Side Profile", description: "Side profile waist-up, showing sleeve shape, garment structure, and side drape", viewAngle: "side", framing: "waist-up" },
  { id: "side-profile-hip-down", name: "Side Profile", description: "Side profile hip to feet, showing leg silhouette, drape, and side seam detail", viewAngle: "side", framing: "hip-down" },
  { id: "side-walking-hip-down", name: "Walking (Side)", description: "Side walking stride, hip to feet, showing leg movement and fabric flow", viewAngle: "side", framing: "hip-down" },
  { id: "side-profile-knee-down", name: "Side Knee-Down", description: "Side view knee to feet, showing pant break, ankle taper, and hem detail", viewAngle: "side", framing: "knee-down" },
  { id: "tqb-standing-full", name: "¾ Back Standing", description: "Angled away from camera showing back and side, full body head to toe", viewAngle: "three-quarter-back", framing: "full-body" },
  { id: "tqb-walking-full", name: "¾ Back Walking", description: "Walking at angle away from camera, full body showing back garment in motion", viewAngle: "three-quarter-back", framing: "full-body" },
  { id: "tqb-standing-3q", name: "¾ Back Standing", description: "Angled away, framed from head to below knee showing back detail", viewAngle: "three-quarter-back", framing: "three-quarter" },
  { id: "tqb-standing-waist", name: "¾ Back Standing", description: "Angled away, waist-up crop showing back yoke, shoulder seams, and upper garment", viewAngle: "three-quarter-back", framing: "waist-up" },
  { id: "tqb-standing-hip-down", name: "¾ Back Standing", description: "Angled away, hip to feet showing back pockets, rear fit, and leg silhouette", viewAngle: "three-quarter-back", framing: "hip-down" },
  { id: "back-standing-full", name: "Back Standing", description: "Standing with back to camera, full rear view from head to toe", viewAngle: "back", framing: "full-body" },
  { id: "back-over-shoulder-full", name: "Over-the-Shoulder", description: "Back to camera, head turned looking over shoulder, full body visible", viewAngle: "back", framing: "full-body" },
  { id: "back-walking-full", name: "Walking Away", description: "Walking away from camera, showing full back of outfit from head to toe", viewAngle: "back", framing: "full-body" },
  { id: "back-seated-full", name: "Seated (Back)", description: "Seated with back to camera, showing how garment looks from behind while sitting", viewAngle: "back", framing: "full-body" },
  { id: "back-standing-3q", name: "Back Standing", description: "Back to camera, framed from head to below knee showing rear garment detail", viewAngle: "back", framing: "three-quarter" },
  { id: "back-walking-3q", name: "Walking Away", description: "Walking away, framed from head to below knee", viewAngle: "back", framing: "three-quarter" },
  { id: "back-standing-waist", name: "Back Standing", description: "Back to camera, waist-up showing back yoke, shoulder seams, and back closure", viewAngle: "back", framing: "waist-up" },
  { id: "back-over-shoulder-waist", name: "Over-Shoulder", description: "Looking over shoulder, waist-up showing back neckline and upper back detail", viewAngle: "back", framing: "waist-up" },
  { id: "back-standing-hip-down", name: "Back Standing", description: "Back to camera, hip to feet showing back pockets, rear seams, and hemline", viewAngle: "back", framing: "hip-down" },
  { id: "back-walking-hip-down", name: "Walking Away", description: "Walking away, hip to feet showing rear fit, movement, and leg drape", viewAngle: "back", framing: "hip-down" },
  { id: "back-standing-knee-down", name: "Back Knee-Down", description: "Back view knee to feet, showing rear hemline, calf fit, and heel-to-hem detail", viewAngle: "back", framing: "knee-down" },
  { id: "ghost-front-full", name: "Ghost Front Full", description: "Front view of the garment shaped as if worn by an invisible person, full garment visible from neckline to hem, no visible model or mannequin", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-front-closeup", name: "Ghost Front Close-Up", description: "Front close-up of the garment on an invisible form, emphasizing neckline, collar, button placket, and upper construction details", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-back-full", name: "Ghost Back Full", description: "Back view of the garment shaped as if worn by an invisible person, showing back panel, yoke, rear construction, and hemline", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-3q-front", name: "Ghost ¾ Front", description: "Three-quarter front angle of the garment on an invisible form, showing depth, drape, and 3D silhouette from neckline to hem", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-side-full", name: "Ghost Side Full", description: "Side profile of the garment shaped as if worn by an invisible person, emphasizing silhouette, fabric drape, side seams, and overall fit profile", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-hollow-neck", name: "Ghost Hollow Neck", description: "Ghost mannequin shot with hollow neck/chest area exposed — shows inner neckline, collar construction, inner labels, and seamwork that is normally hidden when worn", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-flat-lay", name: "Ghost Flat Lay", description: "Flat lay arrangement of the garment on a clean surface, neatly styled with sleeves folded or spread, showing the entire garment laid flat in a professional e-commerce format", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-floating", name: "Ghost Floating", description: "Garment appears to float mid-air as if worn by an invisible person in a natural standing pose, casting a subtle shadow below — dramatic product-focused shot", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-detail-texture", name: "Ghost Detail Focus", description: "Extreme close-up of fabric texture, stitching, and material quality on the ghost-mannequin form — macro-style detail shot showcasing garment craftsmanship", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
];

const OUTPUT_DIR = path.resolve(import.meta.dirname!, "../public/poses");
const CONCURRENCY = 3;
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 2;

function getFramingDescription(framing: string): string {
  const map: Record<string, string> = {
    "full-body": "full body from head to toe",
    "three-quarter": "head to just below the knees (three-quarter body)",
    "mid-thigh": "head to mid-thigh (cowboy shot)",
    "waist-up": "waist up, upper body only",
    "bust-up": "chest and above, close-up",
    "hip-down": "hip to feet, lower body only",
    "knee-down": "knee to feet only",
    "ghost-mannequin": "garment shaped as if worn by an invisible person, no visible human model",
  };
  return map[framing] ?? framing;
}

function getViewDescription(viewAngle: string): string {
  const map: Record<string, string> = {
    front: "facing the camera directly from the front",
    "three-quarter-front": "angled approximately 45 degrees toward the camera",
    side: "in full side profile",
    "three-quarter-back": "angled approximately 45 degrees away from the camera",
    back: "with back turned fully to the camera",
    ghost: "as an invisible mannequin / ghost mannequin",
  };
  return map[viewAngle] ?? viewAngle;
}

function buildPrompt(pose: Pose): string {
  const isGhost = pose.requiresModel === false;
  const framingDesc = getFramingDescription(pose.framing);
  const viewDesc = getViewDescription(pose.viewAngle);

  if (isGhost) {
    return [
      `A professional e-commerce product photograph of a plain white t-shirt displayed using the ghost mannequin / invisible mannequin technique.`,
      `The garment is shaped as if worn by an invisible person — ${pose.description}.`,
      `Camera angle: ${viewDesc}. Framing: ${framingDesc}.`,
      `Clean white studio background with soft even lighting. No visible model, mannequin, or support structure.`,
      `The image should look like a high-end e-commerce catalog photo. Crisp, well-lit, professional product photography.`,
      `Simple, minimal composition focused entirely on the garment silhouette.`,
    ].join(" ");
  }

  return [
    `A professional fashion photograph of a female model ${viewDesc},`,
    `wearing a simple plain white t-shirt and dark blue jeans.`,
    `Pose: ${pose.name} — ${pose.description}.`,
    `Framing: ${framingDesc}.`,
    `The model has a natural, confident expression with relaxed body language.`,
    `Clean white studio background with soft, even lighting and subtle shadows.`,
    `High-end e-commerce fashion photography style. Crisp focus, professional lighting.`,
    `Simple, minimal composition. No text, watermarks, or overlays.`,
  ].join(" ");
}

async function generateImage(
  ai: InstanceType<typeof GoogleGenAI>,
  pose: Pose,
): Promise<Buffer | null> {
  const prompt = buildPrompt(pose);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [{ text: prompt }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      } as any);

      const candidates = (response as any).candidates;
      if (!candidates?.[0]?.content?.parts) {
        throw new Error("No candidates in response");
      }

      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return Buffer.from(part.inlineData.data, "base64");
        }
      }

      throw new Error("No image data in response");
    } catch (err: any) {
      const isLast = attempt === MAX_RETRIES;
      console.error(
        `  [attempt ${attempt + 1}/${MAX_RETRIES + 1}] Error for ${pose.id}: ${err.message}`,
      );
      if (isLast) return null;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processQueue(
  ai: InstanceType<typeof GoogleGenAI>,
  poses: Pose[],
  force: boolean,
) {
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const total = poses.length;
  const queue = [...poses];

  async function worker() {
    while (queue.length > 0) {
      const pose = queue.shift()!;
      const outPath = path.join(OUTPUT_DIR, `${pose.id}.png`);

      if (!force && fs.existsSync(outPath)) {
        skipped++;
        console.log(`[${completed + skipped + failed}/${total}] SKIP ${pose.id} (exists)`);
        continue;
      }

      console.log(`[${completed + skipped + failed + 1}/${total}] Generating ${pose.id} ...`);
      const buf = await generateImage(ai, pose);

      if (buf) {
        fs.writeFileSync(outPath, buf);
        completed++;
        console.log(`  ✓ Saved ${pose.id}.png (${(buf.length / 1024).toFixed(0)} KB)`);
      } else {
        failed++;
        console.error(`  ✗ FAILED ${pose.id}`);
      }

      await sleep(500);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log("\n═══════════════════════════════════");
  console.log(`Done! ${completed} generated, ${skipped} skipped, ${failed} failed out of ${total}`);
  if (failed > 0) {
    console.log("Re-run the script to retry failed poses (existing ones will be skipped).");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));

  const force = flags.includes("--force");
  const dryRun = flags.includes("--dry-run");
  const idFlag = flags.find((f) => f.startsWith("--id="));
  const filterIds = idFlag ? idFlag.replace("--id=", "").split(",") : null;

  const apiKey = positional[0];
  if (!apiKey && !dryRun) {
    console.error("Usage: npx tsx scripts/generate-pose-images.mts <GEMINI_API_KEY> [--force] [--dry-run] [--id=pose-id]");
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let posesToGenerate = POSES;
  if (filterIds) {
    posesToGenerate = POSES.filter((p) => filterIds.includes(p.id));
    if (posesToGenerate.length === 0) {
      console.error(`No poses found matching ids: ${filterIds.join(", ")}`);
      process.exit(1);
    }
  }

  console.log(`\nPose Image Generator`);
  console.log(`═══════════════════════════════════`);
  console.log(`Total poses: ${posesToGenerate.length}`);
  console.log(`On-model: ${posesToGenerate.filter((p) => p.requiresModel !== false).length}`);
  console.log(`Ghost mannequin: ${posesToGenerate.filter((p) => p.requiresModel === false).length}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Force: ${force}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`═══════════════════════════════════\n`);

  if (dryRun) {
    for (const pose of posesToGenerate) {
      const exists = fs.existsSync(path.join(OUTPUT_DIR, `${pose.id}.png`));
      console.log(`${exists ? "EXISTS" : "GENERATE"} ${pose.id} (${pose.viewAngle} / ${pose.framing})`);
    }
    return;
  }

  const ai = new GoogleGenAI({ apiKey: apiKey! });
  await processQueue(ai, posesToGenerate, force);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
