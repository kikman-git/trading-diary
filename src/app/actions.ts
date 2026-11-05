"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import {
  mistakes,
  screenshots,
  tags,
  trades,
  tradeMistakes,
  tradeTags,
} from "@/db/schema";
import { SCREENSHOTS_DIR } from "@/lib/paths";
import { saveScreenshotFiles } from "@/lib/images";
import { computePnl, computeR, initialRisk } from "@/lib/pnl";
import { DEFAULT_MULTIPLIERS } from "@/lib/constants";

export type ActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

type Parsed = {
  status: "open" | "closed";
  instrumentType: "stock" | "option" | "future";
  symbol: string;
  exchange: string | null;
  direction: "long" | "short";
  quantity: number;
  multiplier: number;
  entryPrice: number | null;
  exitPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  fees: number;
  strike: number | null;
  expiry: string | null;
  right: "call" | "put" | null;
  setup: string | null;
  notes: string;
  grade: "a" | "b" | "c" | "d" | "f" | null;
  lesson: string;
  tags: string[];
  mistakes: string[];
  entryAt: Date;
  exitAt: Date | null;
};

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
function numN(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateN(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function filesFrom(fd: FormData, key = "screenshots"): File[] {
  return fd.getAll(key).filter((v): v is File => v instanceof File && v.size > 0);
}

function parse(fd: FormData): Parsed {
  const it = str(fd, "instrumentType");
  const instrumentType = (["stock", "option", "future"].includes(it)
    ? it
    : "stock") as Parsed["instrumentType"];
  const right = str(fd, "right");
  return {
    status: str(fd, "status") === "closed" ? "closed" : "open",
    instrumentType,
    symbol: str(fd, "symbol").toUpperCase(),
    exchange: str(fd, "exchange").toUpperCase() || null,
    direction: str(fd, "direction") === "short" ? "short" : "long",
    quantity: numN(fd, "quantity") ?? 0,
    multiplier:
      numN(fd, "multiplier") ?? DEFAULT_MULTIPLIERS[instrumentType] ?? 1,
    entryPrice: numN(fd, "entryPrice"),
    exitPrice: numN(fd, "exitPrice"),
    stopPrice: numN(fd, "stopPrice"),
    targetPrice: numN(fd, "targetPrice"),
    fees: numN(fd, "fees") ?? 0,
    strike: numN(fd, "strike"),
    expiry: str(fd, "expiry") || null,
    right: right === "call" || right === "put" ? right : null,
    setup: str(fd, "setup") || null,
    notes: str(fd, "notes"),
    grade: (["a", "b", "c", "d", "f"].includes(str(fd, "grade"))
      ? str(fd, "grade")
      : null) as Parsed["grade"],
    lesson: str(fd, "lesson"),
    tags: str(fd, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    mistakes: str(fd, "mistakes")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    entryAt: dateN(str(fd, "entryAt")) ?? new Date(),
    exitAt: dateN(str(fd, "exitAt")),
  };
}

function validate(p: Parsed): string | null {
  if (!p.symbol) return "Symbol is required.";
  if (!(p.quantity > 0)) return "Quantity must be greater than 0.";
  if (p.entryPrice == null) return "Entry price is required.";
  if (p.status === "closed" && p.exitPrice == null)
    return "Exit price is required to save a closed trade.";
  return null;
}

async function syncTags(tradeId: number, names: string[]) {
  const clean = [
    ...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean)),
  ];
  await db.delete(tradeTags).where(eq(tradeTags.tradeId, tradeId));
  for (const name of clean) {
    const existing = await db
      .select()
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);
    let tagId = existing[0]?.id;
    if (tagId == null) {
      const [ins] = await db
        .insert(tags)
        .values({ name })
        .returning({ id: tags.id });
      tagId = ins.id;
    }
    await db.insert(tradeTags).values({ tradeId, tagId }).onConflictDoNothing();
  }
}

async function syncMistakes(tradeId: number, names: string[]) {
  const clean = [
    ...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean)),
  ];
  await db.delete(tradeMistakes).where(eq(tradeMistakes.tradeId, tradeId));
  for (const name of clean) {
    const existing = await db
      .select()
      .from(mistakes)
      .where(eq(mistakes.name, name))
      .limit(1);
    let mistakeId = existing[0]?.id;
    if (mistakeId == null) {
      const [ins] = await db
        .insert(mistakes)
        .values({ name })
        .returning({ id: mistakes.id });
      mistakeId = ins.id;
    }
    await db
      .insert(tradeMistakes)
      .values({ tradeId, mistakeId })
      .onConflictDoNothing();
  }
}

async function appendScreenshots(tradeId: number, files: File[]) {
  if (!files.length) return;
  const existing = await db
    .select({ id: screenshots.id })
    .from(screenshots)
    .where(eq(screenshots.tradeId, tradeId));
  const saved = await saveScreenshotFiles(tradeId, files);
  if (saved.length) {
    await db.insert(screenshots).values(
      saved.map((s, i) => ({
        tradeId,
        filePath: s.filePath,
        thumbPath: s.thumbPath,
        width: s.width,
        height: s.height,
        sortOrder: existing.length + i,
      })),
    );
  }
}

export async function createTrade(fd: FormData): Promise<ActionResult> {
  const p = parse(fd);
  const err = validate(p);
  if (err) return { ok: false, error: err };
  const now = new Date();
  const pnl =
    p.status === "closed"
      ? computePnl({
          direction: p.direction,
          entryPrice: p.entryPrice!,
          exitPrice: p.exitPrice,
          quantity: p.quantity,
          multiplier: p.multiplier,
          fees: p.fees,
        })
      : null;
  const risk = initialRisk({
    entryPrice: p.entryPrice!,
    stopPrice: p.stopPrice,
    quantity: p.quantity,
    multiplier: p.multiplier,
  });

  const [row] = await db
    .insert(trades)
    .values({
      status: p.status,
      instrumentType: p.instrumentType,
      symbol: p.symbol,
      exchange: p.exchange,
      direction: p.direction,
      quantity: p.quantity,
      multiplier: p.multiplier,
      entryPrice: p.entryPrice!,
      exitPrice: p.exitPrice,
      stopPrice: p.stopPrice,
      targetPrice: p.targetPrice,
      fees: p.fees,
      strike: p.strike,
      expiry: p.expiry,
      right: p.right,
      setup: p.setup,
      notes: p.notes,
      grade: p.status === "closed" ? p.grade : null,
      lesson: p.status === "closed" ? p.lesson || null : null,
      pnl,
      rMultiple: computeR(pnl, risk),
      entryAt: p.entryAt,
      exitAt: p.status === "closed" ? (p.exitAt ?? now) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: trades.id });

  await syncTags(row.id, p.tags);
  await syncMistakes(row.id, p.status === "closed" ? p.mistakes : []);
  await appendScreenshots(row.id, filesFrom(fd));
  revalidatePath("/");
  return { ok: true, id: row.id };
}

export async function closeTrade(fd: FormData): Promise<ActionResult> {
  const id = Number(str(fd, "tradeId"));
  if (!Number.isFinite(id)) return { ok: false, error: "Bad trade id." };
  const found = await db.select().from(trades).where(eq(trades.id, id)).limit(1);
  const t = found[0];
  if (!t) return { ok: false, error: "Trade not found." };
  const exitPrice = numN(fd, "exitPrice");
  if (exitPrice == null) return { ok: false, error: "Exit price is required." };
  const fees = numN(fd, "fees") ?? t.fees;
  const exitAt = dateN(str(fd, "exitAt")) ?? new Date();
  const pnl = computePnl({
    direction: t.direction,
    entryPrice: t.entryPrice,
    exitPrice,
    quantity: t.quantity,
    multiplier: t.multiplier,
    fees,
  });
  const risk = initialRisk({
    entryPrice: t.entryPrice,
    stopPrice: t.stopPrice,
    quantity: t.quantity,
    multiplier: t.multiplier,
  });
  const extra = str(fd, "addNotes");
  const notes = extra
    ? `${t.notes}${t.notes ? "\n\n" : ""}---\n**Close note:** ${extra}`
    : t.notes;
  const gradeRaw = str(fd, "grade");
  const grade = (["a", "b", "c", "d", "f"].includes(gradeRaw)
    ? gradeRaw
    : null) as Parsed["grade"];
  const lesson = str(fd, "lesson") || null;
  const mistakeNames = str(fd, "mistakes")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  await db
    .update(trades)
    .set({
      status: "closed",
      exitPrice,
      fees,
      exitAt,
      pnl,
      rMultiple: computeR(pnl, risk),
      notes,
      grade,
      lesson,
      updatedAt: new Date(),
    })
    .where(eq(trades.id, id));

  await syncMistakes(id, mistakeNames);
  await appendScreenshots(id, filesFrom(fd));
  revalidatePath("/");
  revalidatePath(`/trades/${id}`);
  return { ok: true, id };
}

export async function updateTrade(fd: FormData): Promise<ActionResult> {
  const id = Number(str(fd, "tradeId"));
  if (!Number.isFinite(id)) return { ok: false, error: "Bad trade id." };
  const exists = await db
    .select({ id: trades.id })
    .from(trades)
    .where(eq(trades.id, id))
    .limit(1);
  if (!exists[0]) return { ok: false, error: "Trade not found." };

  const p = parse(fd);
  const err = validate(p);
  if (err) return { ok: false, error: err };
  const closed = p.status === "closed";

  const pnl = closed
    ? computePnl({
        direction: p.direction,
        entryPrice: p.entryPrice!,
        exitPrice: p.exitPrice,
        quantity: p.quantity,
        multiplier: p.multiplier,
        fees: p.fees,
      })
    : null;
  const risk = initialRisk({
    entryPrice: p.entryPrice!,
    stopPrice: p.stopPrice,
    quantity: p.quantity,
    multiplier: p.multiplier,
  });

  await db
    .update(trades)
    .set({
      status: p.status,
      instrumentType: p.instrumentType,
      symbol: p.symbol,
      exchange: p.exchange,
      direction: p.direction,
      quantity: p.quantity,
      multiplier: p.multiplier,
      entryPrice: p.entryPrice!,
      exitPrice: closed ? p.exitPrice : null,
      stopPrice: p.stopPrice,
      targetPrice: p.targetPrice,
      fees: p.fees,
      strike: p.strike,
      expiry: p.expiry,
      right: p.right,
      setup: p.setup,
      notes: p.notes,
      grade: closed ? p.grade : null,
      lesson: closed ? p.lesson || null : null,
      pnl,
      rMultiple: computeR(pnl, risk),
      entryAt: p.entryAt,
      exitAt: closed ? (p.exitAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(trades.id, id));

  await syncTags(id, p.tags);
  await syncMistakes(id, closed ? p.mistakes : []);
  await appendScreenshots(id, filesFrom(fd));
  revalidatePath("/");
  revalidatePath(`/trades/${id}`);
  return { ok: true, id };
}

export async function deleteTrade(fd: FormData): Promise<ActionResult> {
  const id = Number(str(fd, "tradeId"));
  if (!Number.isFinite(id)) return { ok: false, error: "Bad trade id." };
  await db.delete(trades).where(eq(trades.id, id)); // cascades tags + screenshot rows
  await rm(path.join(SCREENSHOTS_DIR, String(id)), {
    recursive: true,
    force: true,
  });
  revalidatePath("/");
  return { ok: true };
}

export async function addScreenshots(fd: FormData): Promise<ActionResult> {
  const id = Number(str(fd, "tradeId"));
  if (!Number.isFinite(id)) return { ok: false, error: "Bad trade id." };
  const files = filesFrom(fd);
  if (!files.length) return { ok: false, error: "No images to add." };
  await appendScreenshots(id, files);
  revalidatePath(`/trades/${id}`);
  return { ok: true, id };
}

export async function deleteScreenshot(fd: FormData): Promise<ActionResult> {
  const id = Number(str(fd, "screenshotId"));
  if (!Number.isFinite(id)) return { ok: false, error: "Bad id." };
  const found = await db
    .select()
    .from(screenshots)
    .where(eq(screenshots.id, id))
    .limit(1);
  const s = found[0];
  if (!s) return { ok: false, error: "Not found." };
  await db.delete(screenshots).where(eq(screenshots.id, id));
  await rm(path.join(SCREENSHOTS_DIR, s.filePath), { force: true });
  await rm(path.join(SCREENSHOTS_DIR, s.thumbPath), { force: true });
  revalidatePath(`/trades/${s.tradeId}`);
  return { ok: true, id: s.tradeId };
}
