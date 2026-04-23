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
  { id: "tqf-standing-full", name: "3/4 Front Standing", description: "Angled front view showing front and side of garment, full body head to toe", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-walking-full", name: "3/4 Front Walking", description: "Walking at an angle towards camera, full body visible showing garment in motion", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-seated-full", name: "3/4 Front Seated", description: "Seated at angle showing how garment drapes when sitting, full body visible", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-leaning-full", name: "3/4 Front Leaning", description: "Leaning casually against a surface at an angle, full body visible", viewAngle: "three-quarter-front", framing: "full-body" },
  { id: "tqf-standing-3q", name: "3/4 Front Standing", description: "Angled front view, framed from head to below knee", viewAngle: "three-quarter-front", framing: "three-quarter" },
  { id: "tqf-walking-3q", name: "3/4 Front Walking", description: "Walking at angle, framed from head to below knee", viewAngle: "three-quarter-front", framing: "three-quarter" },
  { id: "tqf-standing-waist", name: "3/4 Front Standing", description: "Angled front view, waist-up crop showing upper body and partial side", viewAngle: "three-quarter-front", framing: "waist-up" },
  { id: "tqf-seated-waist", name: "3/4 Front Seated", description: "Seated at angle, waist-up crop showing how top drapes while seated", viewAngle: "three-quarter-front", framing: "waist-up" },
  { id: "tqf-standing-hip-down", name: "3/4 Front Standing", description: "Angled front view, hip to feet showing lower garment with dimensional depth", viewAngle: "three-quarter-front", framing: "hip-down" },
  { id: "side-profile-full", name: "Side Profile", description: "Full side profile showing complete garment silhouette and drape, head to toe", viewAngle: "side", framing: "full-body" },
  { id: "side-walking-full", name: "Walking (Side)", description: "Mid-stride side view showing movement, flow, and full silhouette", viewAngle: "side", framing: "full-body" },
  { id: "side-leaning-full", name: "Leaning (Side)", description: "Leaning against surface in profile, showing how garment drapes with gravity", viewAngle: "side", framing: "full-body" },
  { id: "side-profile-3q", name: "Side Profile", description: "Side profile from head to below knee, showing upper and mid-body silhouette", viewAngle: "side", framing: "three-quarter" },
  { id: "side-walking-3q", name: "Walking (Side)", description: "Side walking stride, head to below knee, showing movement in profile", viewAngle: "side", framing: "three-quarter" },
  { id: "side-profile-waist", name: "Side Profile", description: "Side profile waist-up, showing sleeve shape, garment structure, and side drape", viewAngle: "side", framing: "waist-up" },
  { id: "side-profile-hip-down", name: "Side Profile", description: "Side profile hip to feet, showing leg silhouette, drape, and side seam detail", viewAngle: "side", framing: "hip-down" },
  { id: "side-walking-hip-down", name: "Walking (Side)", description: "Side walking stride, hip to feet, showing leg movement and fabric flow", viewAngle: "side", framing: "hip-down" },
  { id: "side-profile-knee-down", name: "Side Knee-Down", description: "Side view knee to feet, showing pant break, ankle taper, and hem detail", viewAngle: "side", framing: "knee-down" },
  { id: "tqb-standing-full", name: "3/4 Back Standing", description: "Angled away from camera showing back and side, full body head to toe", viewAngle: "three-quarter-back", framing: "full-body" },
  { id: "tqb-walking-full", name: "3/4 Back Walking", description: "Walking at angle away from camera, full body showing back garment in motion", viewAngle: "three-quarter-back", framing: "full-body" },
  { id: "tqb-standing-3q", name: "3/4 Back Standing", description: "Angled away, framed from head to below knee showing back detail", viewAngle: "three-quarter-back", framing: "three-quarter" },
  { id: "tqb-standing-waist", name: "3/4 Back Standing", description: "Angled away, waist-up crop showing back yoke, shoulder seams, and upper garment", viewAngle: "three-quarter-back", framing: "waist-up" },
  { id: "tqb-standing-hip-down", name: "3/4 Back Standing", description: "Angled away, hip to feet showing back pockets, rear fit, and leg silhouette", viewAngle: "three-quarter-back", framing: "hip-down" },
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
  { id: "ghost-3q-front", name: "Ghost 3/4 Front", description: "Three-quarter front angle of the garment on an invisible form, showing depth, drape, and 3D silhouette from neckline to hem", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-side-full", name: "Ghost Side Full", description: "Side profile of the garment shaped as if worn by an invisible person, emphasizing silhouette, fabric drape, side seams, and overall fit profile", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-hollow-neck", name: "Ghost Hollow Neck", description: "Ghost mannequin shot with hollow neck/chest area exposed — shows inner neckline, collar construction, inner labels, and seamwork that is normally hidden when worn", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-flat-lay", name: "Ghost Flat Lay", description: "Flat lay arrangement of the garment on a clean surface, neatly styled with sleeves folded or spread, showing the entire garment laid flat in a professional e-commerce format", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-floating", name: "Ghost Floating", description: "Garment appears to float mid-air as if worn by an invisible person in a natural standing pose, casting a subtle shadow below — dramatic product-focused shot", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
  { id: "ghost-detail-texture", name: "Ghost Detail Focus", description: "Extreme close-up of fabric texture, stitching, and material quality on the ghost-mannequin form — macro-style detail shot showcasing garment craftsmanship", viewAngle: "ghost", framing: "ghost-mannequin", requiresModel: false },
];

const OUTPUT_DIR = path.resolve(import.meta.dirname!, "../public/poses");
const CONCURRENCY = 3;
const MAX_REGEN_ATTEMPTS = 3;

const FRAMING_RULES: Record<string, string> = {
  "full-body": "The image MUST show the model's COMPLETE body from head to toe, including feet. Nothing should be cropped.",
  "three-quarter": "The image MUST be cropped so the LOWEST visible body part is JUST BELOW THE KNEES. The lower calves and feet must NOT be visible. The head must be visible at the top.",
  "mid-thigh": "The image MUST be cropped at MID-THIGH level. Only head down to mid-thigh is visible. Knees, lower legs, and feet must NOT be visible.",
  "waist-up": "The image MUST be cropped at the WAIST or HIP. Only the upper body (head, torso, arms) is visible. Nothing below the waist/hip should be visible.",
  "bust-up": "The image MUST be cropped at the UPPER CHEST. Only the upper chest, neck, and head are visible. This is a close-up shot.",
  "hip-down": "The image MUST show ONLY the lower body from HIP to FEET. The head, chest, and upper torso must NOT be visible.",
  "knee-down": "The image MUST show ONLY from the KNEES down to the FEET. Everything above the knees must NOT be visible.",
  "ghost-mannequin": "The image must show the garment on an invisible mannequin form with NO visible human model.",
};

const VIEW_RULES: Record<string, string> = {
  "front": "Camera is directly in FRONT of the subject, facing them head-on.",
  "three-quarter-front": "Camera is at approximately 45 degrees to the front, showing both front and side.",
  "side": "Camera is at 90 degrees showing a FULL SIDE PROFILE.",
  "three-quarter-back": "Camera is at approximately 45 degrees to the back, showing both back and side.",
  "back": "Camera is directly BEHIND the subject, showing their back.",
  "ghost": "No specific camera angle requirement beyond showing the garment form.",
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function verifyImage(ai: InstanceType<typeof GoogleGenAI>, pose: Pose, imageBuffer: Buffer): Promise<{ pass: boolean; reason: string }> {
  const framingRule = FRAMING_RULES[pose.framing] ?? "";
  const viewRule = VIEW_RULES[pose.viewAngle] ?? "";

  const prompt = `You are a strict quality-control inspector for fashion photography. Analyze this image against the EXACT specifications below.

POSE: "${pose.name}" — ${pose.description}
VIEW ANGLE: ${pose.viewAngle} — ${viewRule}
FRAMING: ${pose.framing} — ${framingRule}

CRITICAL CHECKS:
1. FRAMING (most important): Does the image crop match the framing specification EXACTLY?
   - "full-body" = head to toe visible, feet included
   - "three-quarter" = head to just below knees, NO feet or lower calves visible
   - "mid-thigh" = head to mid-thigh only, NO knees visible
   - "waist-up" = head to waist only, NO hips or legs visible
   - "bust-up" = upper chest and head only
   - "hip-down" = hip to feet only, NO upper body
   - "knee-down" = knees to feet only
   - "ghost-mannequin" = garment on invisible form, no human

2. VIEW ANGLE: Is the camera positioned correctly (front/side/back/angled)?

3. POSE: Does the body position match the described pose?

Respond with EXACTLY this format (no other text):
RESULT: PASS or FAIL
REASON: One sentence explaining why it passes or what specifically is wrong.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: imageBuffer.toString("base64") } },
        ],
      }],
    } as any);

    const text = (response as any).candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .filter(Boolean)
      .join("") ?? "";

    const passMatch = text.match(/RESULT:\s*(PASS|FAIL)/i);
    const reasonMatch = text.match(/REASON:\s*(.+)/i);

    if (!passMatch) return { pass: false, reason: `Could not parse response: ${text.slice(0, 200)}` };

    return {
      pass: passMatch[1].toUpperCase() === "PASS",
      reason: reasonMatch?.[1]?.trim() ?? "No reason given",
    };
  } catch (err: any) {
    return { pass: false, reason: `Verification error: ${err.message}` };
  }
}

function buildStrictPrompt(pose: Pose): string {
  const isGhost = pose.requiresModel === false;
  const framingRule = FRAMING_RULES[pose.framing] ?? "";
  const viewRule = VIEW_RULES[pose.viewAngle] ?? "";

  if (isGhost) {
    return [
      `A professional e-commerce product photograph of a plain white t-shirt displayed using the ghost mannequin / invisible mannequin technique.`,
      `${pose.description}.`,
      `${framingRule}`,
      `Clean white studio background with soft even lighting. No visible model, mannequin, or support structure.`,
      `Professional product photography. Simple, minimal composition.`,
    ].join("\n");
  }

  const cropNegatives: Record<string, string> = {
    "three-quarter": "CRITICAL: The image must be CROPPED so that the lowest visible part is just BELOW THE KNEES. The feet and lower calves are NOT in frame — they are cut off by the bottom edge of the image. Do NOT show a full body shot.",
    "mid-thigh": "CRITICAL: The image must be CROPPED at MID-THIGH level. The knees and everything below are NOT in frame — cut off by the bottom edge. Do NOT show legs below mid-thigh.",
    "waist-up": "CRITICAL: The image must be CROPPED at the WAIST. Nothing below the waist is visible — cut off by the bottom edge. Do NOT show any legs or hip area.",
    "bust-up": "CRITICAL: The image must be CROPPED at the UPPER CHEST. Only head, neck, and upper chest are visible. Everything below is cut off.",
    "hip-down": "CRITICAL: The image must be CROPPED so only HIP TO FEET is visible. The head, chest, and upper body are NOT in frame — cut off by the top edge.",
    "knee-down": "CRITICAL: The image must be CROPPED so only KNEES TO FEET is visible. Everything above the knees is NOT in frame.",
  };

  const negativeInstr = cropNegatives[pose.framing] ?? "";

  return [
    `A professional fashion photograph of a female model wearing a simple plain white t-shirt and dark blue jeans.`,
    ``,
    `CAMERA ANGLE: ${viewRule}`,
    ``,
    `POSE: ${pose.name} — ${pose.description}`,
    ``,
    `FRAMING REQUIREMENT (STRICTLY ENFORCED):`,
    `${framingRule}`,
    negativeInstr,
    ``,
    `The model has a natural, confident expression. Clean white studio background with soft, even lighting.`,
    `High-end e-commerce fashion photography. No text, watermarks, or overlays.`,
  ].filter(Boolean).join("\n");
}

async function generateImage(ai: InstanceType<typeof GoogleGenAI>, pose: Pose): Promise<Buffer | null> {
  const prompt = buildStrictPrompt(pose);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ text: prompt }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "1:1" },
      },
    } as any);

    const candidates = (response as any).candidates;
    if (!candidates?.[0]?.content?.parts) return null;
    for (const part of candidates[0].content.parts) {
      if (part.inlineData) return Buffer.from(part.inlineData.data, "base64");
    }
    return null;
  } catch (err: any) {
    console.error(`  Generation error: ${err.message}`);
    return null;
  }
}

async function main() {
  const apiKey = process.argv[2];
  const onlyVerify = process.argv.includes("--verify-only");
  if (!apiKey) {
    console.error("Usage: npx tsx scripts/verify-and-regen.mts <API_KEY> [--verify-only]");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const failures: Pose[] = [];
  let passCount = 0;

  console.log("\n=== PHASE 1: VERIFICATION ===\n");

  // Verify sequentially to avoid rate limits on the text model
  for (let i = 0; i < POSES.length; i++) {
    const pose = POSES[i];
    const imgPath = path.join(OUTPUT_DIR, `${pose.id}.png`);
    if (!fs.existsSync(imgPath)) {
      console.log(`[${i + 1}/${POSES.length}] MISSING ${pose.id}`);
      failures.push(pose);
      continue;
    }

    const buf = fs.readFileSync(imgPath);
    console.log(`[${i + 1}/${POSES.length}] Verifying ${pose.id} (${pose.framing}) ...`);
    const result = await verifyImage(ai, pose, buf);

    if (result.pass) {
      passCount++;
      console.log(`  PASS: ${result.reason}`);
    } else {
      failures.push(pose);
      console.log(`  FAIL: ${result.reason}`);
    }
    await sleep(300);
  }

  console.log(`\n--- Verification Summary ---`);
  console.log(`Passed: ${passCount}/${POSES.length}`);
  console.log(`Failed: ${failures.length}/${POSES.length}`);

  if (failures.length > 0) {
    console.log(`\nFailed poses:`);
    for (const p of failures) {
      console.log(`  - ${p.id} (${p.viewAngle} / ${p.framing})`);
    }
  }

  if (onlyVerify || failures.length === 0) return;

  console.log(`\n=== PHASE 2: REGENERATION (${failures.length} poses) ===\n`);

  for (const pose of failures) {
    let success = false;
    for (let attempt = 1; attempt <= MAX_REGEN_ATTEMPTS; attempt++) {
      console.log(`[${pose.id}] Attempt ${attempt}/${MAX_REGEN_ATTEMPTS}: Generating ...`);
      const buf = await generateImage(ai, pose);
      if (!buf) {
        console.log(`  Generation failed, retrying ...`);
        await sleep(2000);
        continue;
      }

      console.log(`  Verifying regenerated image ...`);
      const check = await verifyImage(ai, pose, buf);
      if (check.pass) {
        const outPath = path.join(OUTPUT_DIR, `${pose.id}.png`);
        fs.writeFileSync(outPath, buf);
        console.log(`  PASS — saved! (${(buf.length / 1024).toFixed(0)} KB)`);
        success = true;
        break;
      } else {
        console.log(`  Still failing: ${check.reason}`);
        if (attempt === MAX_REGEN_ATTEMPTS) {
          // Save the last attempt anyway as it might be better than what we had
          const outPath = path.join(OUTPUT_DIR, `${pose.id}.png`);
          fs.writeFileSync(outPath, buf);
          console.log(`  Saved best attempt after ${MAX_REGEN_ATTEMPTS} tries.`);
        }
      }
      await sleep(1000);
    }
    if (!success) console.log(`  WARNING: ${pose.id} could not be fixed after ${MAX_REGEN_ATTEMPTS} attempts.`);
  }

  console.log(`\nDone!`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
