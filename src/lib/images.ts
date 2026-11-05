import "server-only";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SCREENSHOTS_DIR } from "@/lib/paths";
import { MAX_IMAGE_WIDTH, THUMB_WIDTH } from "./constants";

export type SavedImage = {
  filePath: string;
  thumbPath: string;
  width: number;
  height: number;
};

/** Downscale + re-encode to webp, write a full + thumb pair under <tradeId>/. */
export async function saveScreenshotFiles(
  tradeId: number,
  files: File[],
): Promise<SavedImage[]> {
  const out: SavedImage[] = [];
  const dir = path.join(SCREENSHOTS_DIR, String(tradeId));
  await mkdir(dir, { recursive: true });

  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (file.type && !file.type.startsWith("image/")) continue;

    const buf = Buffer.from(await file.arrayBuffer());
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fullName = `${base}.webp`;
    const thumbName = `${base}.thumb.webp`;

    const full = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    await writeFile(path.join(dir, fullName), full.data);

    const thumb = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    await writeFile(path.join(dir, thumbName), thumb);

    out.push({
      filePath: `${tradeId}/${fullName}`,
      thumbPath: `${tradeId}/${thumbName}`,
      width: full.info.width ?? 0,
      height: full.info.height ?? 0,
    });
  }
  return out;
}
