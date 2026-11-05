import { type NextRequest } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { SCREENSHOTS_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const abs = path.join(SCREENSHOTS_DIR, ...parts);

  // Prevent path traversal outside the screenshots dir.
  if (abs !== SCREENSHOTS_DIR && !abs.startsWith(SCREENSHOTS_DIR + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const s = await stat(abs);
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    const data = await readFile(abs);
    const type =
      TYPES[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
